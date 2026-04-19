import { FetchFlightsError } from "./errors.js";
import { buildSearchUrl, type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { parseFlightsHtml, type FlightsSearchResult } from "./parse.js";

export interface RetryOptions {
  /** Max retry attempts after the initial try. 0 disables retry (default). */
  attempts?: number;
  /** Base delay for exponential backoff, in ms. Defaults to 500. */
  baseDelayMs?: number;
  /** Upper bound on a single backoff delay, in ms. Defaults to 10_000. */
  maxDelayMs?: number;
  /** Decide whether to retry a given error/attempt. Default retries on 429, 5xx, and network errors. */
  shouldRetry?: (error: FetchFlightsError, attempt: number) => boolean;
}

export interface FetchFlightsOptions {
  /** Custom fetch implementation (e.g. for proxying, retries, tracing). */
  fetch?: typeof globalThis.fetch;
  /** Headers merged on top of the default browser-like header set. */
  headers?: HeadersInit;
  /** When true, disables the default headers entirely; only `headers` is sent. */
  replaceHeaders?: boolean;
  /** Abort signal forwarded to the underlying fetch. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. Defaults to 30_000. Pass 0 to disable. */
  timeoutMs?: number;
  /** Opt-in retry behavior on transient failures. */
  retry?: RetryOptions;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_HEADERS: Record<string, string> = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};

function resolveFetch(fetchImpl?: typeof globalThis.fetch): typeof globalThis.fetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new FetchFlightsError("No fetch implementation is available. Provide one through options.fetch.");
  }

  return globalThis.fetch.bind(globalThis);
}

function buildHeaders(options: FetchFlightsOptions): HeadersInit {
  if (options.replaceHeaders) {
    return options.headers ?? {};
  }
  return { ...DEFAULT_HEADERS, ...options.headers };
}

function combineSignals(user: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  if (timeoutMs <= 0) {
    return user;
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!user) {
    return timeoutSignal;
  }

  const controller = new AbortController();
  const onAbort = (reason: unknown): void => controller.abort(reason);

  if (user.aborted) controller.abort(user.reason);
  else user.addEventListener("abort", () => onAbort(user.reason), { once: true });

  if (timeoutSignal.aborted) controller.abort(timeoutSignal.reason);
  else timeoutSignal.addEventListener("abort", () => onAbort(timeoutSignal.reason), { once: true });

  return controller.signal;
}

function defaultShouldRetry(error: FetchFlightsError): boolean {
  if (error.status === undefined) return true;
  return error.status === 429 || (error.status >= 500 && error.status < 600);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(signal.reason);
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

async function runWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  retry: RetryOptions | undefined,
  signal: AbortSignal | undefined
): Promise<T> {
  const attempts = Math.max(0, retry?.attempts ?? 0);
  const baseDelayMs = Math.max(0, retry?.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, retry?.maxDelayMs ?? 10_000);
  const shouldRetry = retry?.shouldRetry ?? defaultShouldRetry;

  let lastError: FetchFlightsError | undefined;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (!(error instanceof FetchFlightsError)) throw error;
      lastError = error;
      if (attempt === attempts) break;
      if (signal?.aborted) break;
      if (!shouldRetry(error, attempt + 1)) break;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * baseDelayMs;
      await sleep(backoff + jitter, signal);
    }
  }
  throw lastError!;
}

async function attemptFetchHtml(url: string, options: FetchFlightsOptions): Promise<string> {
  const fetchImpl = resolveFetch(options.fetch);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = combineSignals(options.signal, timeoutMs);

  const init: RequestInit = { headers: buildHeaders(options) };
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new FetchFlightsError(
      `Failed to reach Google Flights: ${(error as Error).message ?? String(error)}`,
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new FetchFlightsError(
      `Google Flights returned ${response.status} ${response.statusText}.`,
      { status: response.status }
    );
  }

  const html = await response.text();

  if (html.length === 0) {
    throw new FetchFlightsError("Google Flights returned an empty HTML response.", {
      status: response.status
    });
  }

  return html;
}

export async function fetchFlightsHtml(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<string> {
  const url = buildSearchUrl(input);
  return runWithRetry(() => attemptFetchHtml(url, options), options.retry, options.signal);
}

export async function fetchFlights(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<FlightsSearchResult> {
  const html = await fetchFlightsHtml(input, options);
  return parseFlightsHtml(html);
}
