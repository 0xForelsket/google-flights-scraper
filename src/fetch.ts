import { defaultSessionCache, SessionCache, type SessionCacheOptions } from "./cache.js";
import { applyPostSearchFilters } from "./filters.js";
import {
  CaptchaError,
  FetchFlightsError,
  HttpError,
  ParseFlightsError,
  RateLimitError,
  TimeoutError
} from "./errors.js";
import {
  parseFlightsHtml,
  parseRpcResponse,
  type FlightsSearchResult
} from "./parse.js";
import { buildSearchUrl, createQuery, decodeQuery, type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { buildRpcRequestBody, buildRpcUrl } from "./rpc.js";

export type ProxyResolver = string | (() => string | Promise<string>);
export type TransportMode = "html" | "rpc" | "auto";

export interface RetryOptions {
  /** Max retry attempts after the initial try. 0 disables retry (default). */
  attempts?: number;
  /** Base delay for exponential backoff, in ms. Defaults to 500. */
  baseDelayMs?: number;
  /** Upper bound on a single backoff delay, in ms. Defaults to 10_000. */
  maxDelayMs?: number;
  /** Decide whether to retry a given error/attempt. Default retries on 429, 5xx, network errors, and timeouts. */
  shouldRetry?: (error: FetchFlightsError, attempt: number) => boolean;
}

export interface RequestTelemetry {
  attempt: number;
  transport: Exclude<TransportMode, "auto">;
  url: string;
  proxy?: string;
}

export interface ResponseTelemetry extends RequestTelemetry {
  status: number;
  ok: boolean;
  bytes: number;
}

export interface ParseErrorTelemetry {
  transport: Exclude<TransportMode, "auto">;
  error: Error;
}

export interface CacheTelemetry {
  key: string;
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
  /**
   * Total request timeout in milliseconds, including retry attempts.
   * Defaults to 30_000. Pass 0 to disable.
   */
  timeoutMs?: number;
  /** Opt-in retry behavior on transient failures. */
  retry?: RetryOptions;
  /** Which transport to use. `auto` tries HTML first, then RPC for structured queries on parse failure. */
  transport?: TransportMode;
  /** Per-attempt proxy or proxy resolver. */
  proxy?: ProxyResolver;
  /** Session-level dedupe/LRU cache. Defaults to enabled. */
  cache?: boolean | SessionCache | SessionCacheOptions;
  /** Request lifecycle hooks. */
  onRequest?: (event: RequestTelemetry) => void;
  onResponse?: (event: ResponseTelemetry) => void;
  onParseError?: (event: ParseErrorTelemetry) => void;
  onCacheHit?: (event: CacheTelemetry) => void;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const GOOGLE_FLIGHTS_SEARCH_URL = "https://www.google.com/travel/flights/search";

const DEFAULT_HEADERS: Record<string, string> = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};

function errorName(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("name" in value)) {
    return undefined;
  }
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function isTimeoutLike(value: unknown): boolean {
  return errorName(value) === "TimeoutError";
}

function abortToFetchError(signal: AbortSignal | undefined, cause: unknown, url?: string): FetchFlightsError {
  if (isTimeoutLike(cause) || isTimeoutLike(signal?.reason)) {
    return new TimeoutError("Google Flights request timed out.", {
      cause,
      ...(url === undefined ? {} : { url })
    });
  }

  return new FetchFlightsError("Google Flights request was aborted.", {
    cause,
    ...(url === undefined ? {} : { url })
  });
}

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
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error.status === undefined) {
    return true;
  }
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

async function resolveProxy(proxy: ProxyResolver | undefined): Promise<string | undefined> {
  if (!proxy) {
    return undefined;
  }

  if (typeof proxy === "string") {
    const trimmed = proxy.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  const resolved = await proxy();
  const trimmed = resolved.trim();
  return trimmed === "" ? undefined : trimmed;
}

async function maybeCreateDispatcher(proxy: string | undefined): Promise<unknown> {
  if (!proxy) {
    return undefined;
  }

  try {
    const { ProxyAgent } = await import("undici");
    return new ProxyAgent(proxy);
  } catch {
    return undefined;
  }
}

function inferStatusText(status: number): string {
  return status === 429 ? "Too Many Requests" : "";
}

function toStructuredInput(input: string | StructuredQueryInput | EncodedQuery): StructuredQueryInput | null {
  if (typeof input === "string") {
    return null;
  }

  if ("tfs" in input) {
    const decoded = decodeQuery(input.tfs);
    if (input.language !== "") {
      decoded.language = input.language;
    }
    if (input.currency !== "") {
      decoded.currency = input.currency;
    }
    if (input.region !== "") {
      decoded.region = input.region;
    }
    return decoded;
  }

  return input;
}

function toEncodedQuery(input: string | StructuredQueryInput | EncodedQuery): EncodedQuery | null {
  if (typeof input === "string") {
    return null;
  }

  return "tfs" in input ? input : createQuery(input);
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

function buildCacheKey(input: string | StructuredQueryInput | EncodedQuery, transport: TransportMode): string {
  if (typeof input === "string") {
    return `string:${transport}:${input}`;
  }

  const encoded = "tfs" in input ? input : createQuery(input);
  const structured = "tfs" in input
    ? {
        ...decodeQuery(input.tfs),
        language: input.language,
        currency: input.currency,
        region: input.region
      }
    : input;

  return JSON.stringify(sortObjectKeys({
    transport,
    encoded,
    structured
  }));
}

function resolveCache(cache: FetchFlightsOptions["cache"]): SessionCache | null {
  if (cache === false) {
    return null;
  }
  if (cache instanceof SessionCache) {
    return cache;
  }
  if (cache === true || cache === undefined) {
    return defaultSessionCache;
  }
  return new SessionCache(cache);
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
      try {
        await sleep(backoff + jitter, signal);
      } catch (sleepError) {
        throw abortToFetchError(signal, sleepError);
      }
    }
  }
  throw lastError!;
}

async function fetchText(
  url: string,
  init: RequestInit,
  options: FetchFlightsOptions,
  signal: AbortSignal | undefined,
  attempt: number,
  transport: Exclude<TransportMode, "auto">
): Promise<{ response: Response; text: string; proxy?: string }> {
  const fetchImpl = resolveFetch(options.fetch);
  const proxy = await resolveProxy(options.proxy);
  const dispatcher = await maybeCreateDispatcher(proxy);
  const finalInit: RequestInit & { dispatcher?: unknown } = { ...init };
  if (signal) {
    finalInit.signal = signal;
  }
  if (dispatcher) {
    finalInit.dispatcher = dispatcher;
  }

  options.onRequest?.({ attempt, transport, url, ...(proxy ? { proxy } : {}) });

  let response: Response;
  try {
    if (signal?.aborted) {
      throw abortToFetchError(signal, signal.reason, url);
    }

    const responsePromise = fetchImpl(url, finalInit);
    if (signal) {
      response = await Promise.race([
        responsePromise,
        new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(abortToFetchError(signal, signal.reason, url)), {
            once: true
          });
        })
      ]);
    } else {
      response = await responsePromise;
    }
  } catch (error) {
    if (error instanceof FetchFlightsError) {
      throw error;
    }
    if (signal?.aborted || isTimeoutLike(error)) {
      throw abortToFetchError(signal, error, url);
    }
    throw new FetchFlightsError(
      `Failed to reach Google Flights: ${(error as Error).message ?? String(error)}`,
      { cause: error, url }
    );
  }

  const text = await response.text();
  options.onResponse?.({
    attempt,
    transport,
    url,
    ...(proxy ? { proxy } : {}),
    status: response.status,
    ok: response.ok,
    bytes: text.length
  });

  return { response, text, ...(proxy ? { proxy } : {}) };
}

function throwForHttpResponse(response: Response, text: string, url: string): never {
  const message = `Google Flights returned ${response.status} ${response.statusText || inferStatusText(response.status)}.`;
  if (response.status === 429) {
    throw new RateLimitError(message, {
      status: response.status,
      statusText: response.statusText || inferStatusText(response.status),
      url: response.url || url
    });
  }
  throw new HttpError(message, {
    status: response.status,
    statusText: response.statusText,
    url: response.url || url
  });
}

async function attemptFetchHtml(
  url: string,
  options: FetchFlightsOptions,
  signal: AbortSignal | undefined,
  attempt: number
): Promise<string> {
  const { response, text } = await fetchText(url, {
    headers: buildHeaders(options)
  }, options, signal, attempt, "html");

  if (!response.ok) {
    throwForHttpResponse(response, text, url);
  }

  if (text.length === 0) {
    throw new FetchFlightsError("Google Flights returned an empty HTML response.", {
      status: response.status,
      statusText: response.statusText,
      url: response.url || url
    });
  }

  return text;
}

async function attemptFetchRpc(
  query: EncodedQuery,
  structured: StructuredQueryInput,
  options: FetchFlightsOptions,
  signal: AbortSignal | undefined,
  attempt: number
): Promise<string> {
  const url = buildRpcUrl(query);
  const { response, text } = await fetchText(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "origin": "https://www.google.com",
      "referer": GOOGLE_FLIGHTS_SEARCH_URL,
      ...buildHeaders(options)
    },
    body: buildRpcRequestBody(structured)
  }, options, signal, attempt, "rpc");

  if (!response.ok) {
    throwForHttpResponse(response, text, url);
  }

  if (text.length === 0) {
    throw new FetchFlightsError("Google Flights returned an empty RPC response.", {
      status: response.status,
      statusText: response.statusText,
      url: response.url || url
    });
  }

  if (text.includes("<html") && text.toLowerCase().includes("captcha")) {
    throw new CaptchaError("Google returned an anti-bot / CAPTCHA page instead of RPC results.");
  }

  return text;
}

function parseWithTelemetry<T>(
  transport: Exclude<TransportMode, "auto">,
  options: FetchFlightsOptions,
  parse: () => T
): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ParseFlightsError || error instanceof CaptchaError) {
      options.onParseError?.({ transport, error });
    }
    throw error;
  }
}

async function fetchViaHtml(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions
): Promise<FlightsSearchResult> {
  const url = buildSearchUrl(input);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  const html = await runWithRetry(
    (attempt) => attemptFetchHtml(url, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
  const result = parseWithTelemetry("html", options, () => parseFlightsHtml(html));
  const structured = toStructuredInput(input);
  return applyPostSearchFilters(result, structured?.filters);
}

async function fetchViaRpc(
  input: StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions
): Promise<FlightsSearchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  const encoded = toEncodedQuery(input)!;
  const structured = toStructuredInput(input)!;
  const text = await runWithRetry(
    (attempt) => attemptFetchRpc(encoded, structured, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
  const result = parseWithTelemetry("rpc", options, () => parseRpcResponse(text));
  return applyPostSearchFilters(result, structured.filters);
}

export async function fetchFlightsHtml(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<string> {
  const url = buildSearchUrl(input);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  return runWithRetry(
    (attempt) => attemptFetchHtml(url, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
}

export async function fetchFlightsRpcText(
  input: StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  const encoded = toEncodedQuery(input)!;
  const structured = toStructuredInput(input)!;
  return runWithRetry(
    (attempt) => attemptFetchRpc(encoded, structured, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
}

export function clearSessionCache(): void {
  defaultSessionCache.clear();
}

export async function fetchFlights(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<FlightsSearchResult> {
  const transport = options.transport ?? "html";
  const structured = toStructuredInput(input);
  const cache = resolveCache(options.cache);
  const cacheKey = buildCacheKey(input, transport);

  const compute = async (): Promise<FlightsSearchResult> => {
    if (transport === "rpc") {
      if (!structured) {
        throw new FetchFlightsError("RPC transport requires a structured or encoded query.");
      }
      return fetchViaRpc(typeof input === "string" ? structured : input, options);
    }

    if (transport === "auto" && structured) {
      try {
        return await fetchViaHtml(input, options);
      } catch (error) {
        if (error instanceof ParseFlightsError) {
          options.onParseError?.({ transport: "html", error });
          return fetchViaRpc(typeof input === "string" ? structured : input, options);
        }
        throw error;
      }
    }

    return fetchViaHtml(input, options);
  };

  if (!cache) {
    return compute();
  }

  const cached = cache.get(cacheKey);
  if (cached) {
    options.onCacheHit?.({ key: cacheKey });
    return cached;
  }

  return cache.set(cacheKey, compute());
}
