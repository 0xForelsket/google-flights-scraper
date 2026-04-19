export interface AirlineMetadata {
    code: string;
    name: string;
}
export interface AllianceMetadata {
    code: string;
    name: string;
}
export interface Airport {
    code: string;
    name: string;
}
export interface SimpleDate {
    year: number;
    month: number;
    day: number;
}
export interface SimpleTime {
    hour: number;
    minute: number;
}
export interface FlightTimestamp {
    date: SimpleDate;
    time: SimpleTime;
}
export interface FlightSegment {
    fromAirport: Airport;
    toAirport: Airport;
    departure: FlightTimestamp;
    arrival: FlightTimestamp;
    durationMinutes: number;
    planeType: string;
    /** IATA operating carrier code (e.g. "TR"). Empty string when Google did not expose it. */
    operatingCarrier: string;
    /** Combined carrier + flight number (e.g. "TR451"). Empty string when unavailable. */
    flightNumber: string;
    /** Human legroom string as Google renders it (e.g. "28 in"). */
    legroom: string;
}
export interface Layover {
    durationMinutes: number;
    airportCode: string;
    airportName: string;
    cityName: string;
    /** True when the onward flight departs from a different airport than the arriving one. */
    changeOfAirport: boolean;
}
export interface CarrierLink {
    code: string;
    name: string;
    /** Carrier-provided URL that Google associates with this flight. May be support/accessibility rather than a direct booking page. */
    url: string;
}
export interface CarbonEmission {
    /** Estimated CO2 emissions for this itinerary, in grams. */
    emission: number;
    /** Typical CO2 emissions for this route, in grams. */
    typicalOnRoute: number;
}
export interface FlightResult {
    type: string;
    price: number;
    airlines: string[];
    segments: FlightSegment[];
    totalDurationMinutes: number;
    stopCount: number;
    layovers: Layover[];
    carbon: CarbonEmission;
    /** Opaque token Google re-submits to open the "Select where to book" page. Empty string when not exposed. */
    bookingToken: string;
    /** Per-flight carrier links as Google renders them. */
    carrierLinks: CarrierLink[];
}
export interface FlightsSearchResult {
    flights: FlightResult[];
    metadata: {
        airlines: AirlineMetadata[];
        alliances: AllianceMetadata[];
    };
}
export declare function parseFlightsHtml(html: string): FlightsSearchResult;
//# sourceMappingURL=parse.d.ts.map