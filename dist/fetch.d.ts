import { type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { type FlightsSearchResult } from "./parse.js";
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
export declare function fetchFlightsHtml(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<string>;
export declare function fetchFlights(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<FlightsSearchResult>;
//# sourceMappingURL=fetch.d.ts.map