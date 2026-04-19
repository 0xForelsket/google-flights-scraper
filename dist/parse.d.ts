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
}
export interface Layover {
    durationMinutes: number;
    airportCode: string;
    airportName: string;
    cityName: string;
}
export interface CarbonEmission {
    emission: number;
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