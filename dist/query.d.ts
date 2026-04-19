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
//# sourceMappingURL=query.d.ts.map