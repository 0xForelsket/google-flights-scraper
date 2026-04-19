export type SeatType = "economy" | "premium-economy" | "business" | "first";
export type TripType = "round-trip" | "one-way" | "multi-city";
export interface FlightQueryInput {
    date: string | Date;
    fromAirport: string;
    toAirport: string;
    maxStops?: number;
    airlines?: string[];
}
export interface PassengerCounts {
    adults?: number;
    children?: number;
    infantsInSeat?: number;
    infantsOnLap?: number;
}
export interface StructuredQueryInput {
    flights: FlightQueryInput[];
    seat?: SeatType;
    trip?: TripType;
    passengers?: PassengerCounts;
    language?: string;
    currency?: string;
    maxStops?: number;
}
export interface EncodedQuery {
    tfs: string;
    language: string;
    currency: string;
    params: URLSearchParams;
    url: string;
}
export declare function createQuery(input: StructuredQueryInput): EncodedQuery;
export declare function buildSearchUrl(input: string | StructuredQueryInput | EncodedQuery): string;
/**
 * Inverse of `createQuery`. Decodes a base64-encoded `tfs` payload back into a
 * structured query input. Useful for debugging generated URLs, round-tripping,
 * and as a structural check against encoder drift.
 *
 * `language` and `currency` are not part of the `tfs` payload, so they are not
 * returned; callers that need them should read the surrounding `hl` / `curr`
 * query-string parameters.
 */
export declare function decodeQuery(tfs: string): StructuredQueryInput;
//# sourceMappingURL=query.d.ts.map