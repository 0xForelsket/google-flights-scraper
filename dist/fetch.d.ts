import { type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { type FlightsSearchResult } from "./parse.js";
export interface FetchFlightsOptions {
    fetch?: typeof globalThis.fetch;
    headers?: HeadersInit;
    signal?: AbortSignal;
}
export declare function fetchFlightsHtml(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<string>;
export declare function fetchFlights(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<FlightsSearchResult>;
//# sourceMappingURL=fetch.d.ts.map