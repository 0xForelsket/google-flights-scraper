import { FetchFlightsError } from "./errors.js";
import { type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { type FlightsSearchResult } from "./parse.js";
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
    /**
     * Total request timeout in milliseconds, including retry attempts.
     * Defaults to 30_000. Pass 0 to disable.
     */
    timeoutMs?: number;
    /** Opt-in retry behavior on transient failures. */
    retry?: RetryOptions;
}
export declare function fetchFlightsHtml(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<string>;
export declare function fetchFlights(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<FlightsSearchResult>;
//# sourceMappingURL=fetch.d.ts.map