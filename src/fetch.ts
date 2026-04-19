import { FetchFlightsError } from "./errors.js";
import { buildSearchUrl, type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { parseFlightsHtml, type FlightsSearchResult } from "./parse.js";

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

function combineSignals(user: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal | undefined;
  cleanup: () => void;
} {
  if (timeoutMs <= 0) {
    return { signal: user, cleanup: () => {} };
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!user) {
    return { signal: timeoutSignal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const onAbort = (reason: unknown): void => controller.abort(reason);

  if (user.aborted) {
    controller.abort(user.reason);
  } else {
    user.addEventListener("abort", () => onAbort(user.reason), { once: true });
  }

  if (timeoutSignal.aborted) {
    controller.abort(timeoutSignal.reason);
  } else {
    timeoutSignal.addEventListener("abort", () => onAbort(timeoutSignal.reason), { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {}
  };
}

export async function fetchFlightsHtml(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<string> {
  const fetchImpl = resolveFetch(options.fetch);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup } = combineSignals(options.signal, timeoutMs);

  const init: RequestInit = {
    headers: buildHeaders(options)
  };

  if (signal) {
    init.signal = signal;
  }

  let response: Response;
  try {
    response = await fetchImpl(buildSearchUrl(input), init);
  } catch (error) {
    throw new FetchFlightsError(
      `Failed to reach Google Flights: ${(error as Error).message ?? String(error)}`,
      { cause: error }
    );
  } finally {
    cleanup();
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

export async function fetchFlights(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<FlightsSearchResult> {
  const html = await fetchFlightsHtml(input, options);
  return parseFlightsHtml(html);
}
