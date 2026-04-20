import { z } from 'zod';

type SeatType = "economy" | "premium-economy" | "business" | "first";
type TripType = "round-trip" | "one-way" | "multi-city";
interface TimeWindow {
    earliest?: string;
    latest?: string;
}
interface LayoverFilter {
    minMinutes?: number;
    maxMinutes?: number;
}
interface ConnectionAirportFilter {
    allow?: string[];
    block?: string[];
}
interface PostSearchFilters {
    departureTime?: TimeWindow;
    arrivalTime?: TimeWindow;
    layover?: LayoverFilter;
    connectionAirports?: ConnectionAirportFilter;
}
interface FlightQueryInput {
    date: string | Date;
    fromAirport: string;
    toAirport: string;
    maxStops?: number;
    airlines?: string[];
}
interface PassengerCounts {
    adults?: number;
    children?: number;
    infantsInSeat?: number;
    infantsOnLap?: number;
}
interface StructuredQueryInput {
    flights: FlightQueryInput[];
    seat?: SeatType;
    trip?: TripType;
    passengers?: PassengerCounts;
    language?: string;
    currency?: string;
    region?: string;
    maxStops?: number;
    filters?: PostSearchFilters;
}
interface EncodedQuery {
    tfs: string;
    language: string;
    currency: string;
    region: string;
    params: URLSearchParams;
    url: string;
}
declare function createQuery(input: StructuredQueryInput): EncodedQuery;
declare function buildSearchUrl(input: string | StructuredQueryInput | EncodedQuery): string;
/**
 * Inverse of `createQuery`. Decodes a base64-encoded `tfs` payload back into a
 * structured query input. Useful for debugging generated URLs, round-tripping,
 * and as a structural check against encoder drift.
 *
 * `language` and `currency` are not part of the `tfs` payload, so they are not
 * returned; callers that need them should read the surrounding `hl` / `curr`
 * query-string parameters.
 */
declare function decodeQuery(tfs: string): StructuredQueryInput;

interface AirlineMetadata {
    code: string;
    name: string;
}
interface AllianceMetadata {
    code: string;
    name: string;
}
interface Airport {
    code: string;
    name: string;
}
interface SimpleDate {
    year: number;
    month: number;
    day: number;
}
interface SimpleTime {
    hour: number;
    minute: number;
}
interface FlightTimestamp {
    date: SimpleDate;
    time: SimpleTime;
}
interface FlightSegment {
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
interface Layover {
    durationMinutes: number;
    airportCode: string;
    airportName: string;
    cityName: string;
    /** True when the onward flight departs from a different airport than the arriving one. */
    changeOfAirport: boolean;
}
type CarrierResourceType = "support" | "baggage";
interface CarrierLink {
    code: string;
    name: string;
    /** Carrier-provided URL that Google associates with this flight. May be support/accessibility rather than a direct booking page. */
    url: string;
    type?: CarrierResourceType;
}
interface CarbonEmission {
    /** Estimated CO2 emissions for this itinerary, in grams. */
    emission: number;
    /** Typical CO2 emissions for this route, in grams. */
    typicalOnRoute: number;
}
interface FarePolicy {
    /**
     * Best-effort refundability hint from Google's internal payload.
     * Google does not expose a stable human label here.
     */
    refundabilityCode: number | null;
    /**
     * Best-effort checked-baggage hint. `null` means Google did not expose one.
     */
    checkedBaggageIncluded: boolean | null;
}
interface FlexibleDatePricePoint {
    epochMs: number;
    date: SimpleDate;
    price: number;
}
interface FlexibleDateInsight {
    destinationLabel: string;
    cheapestPrice: number | null;
    highestPrice: number | null;
    pricePoints: FlexibleDatePricePoint[];
}
interface LocationMetadata {
    code: string;
    kind: "airport" | "city" | "place";
    name: string;
    cityName: string;
    cityCode: string;
    countryCode: string;
    countryName: string;
}
interface FlightResult {
    type: string;
    price: number;
    airlines: string[];
    segments: FlightSegment[];
    totalDurationMinutes: number;
    stopCount: number;
    layovers: Layover[];
    carbon: CarbonEmission;
    farePolicy: FarePolicy;
    /** Opaque token Google re-submits to open the "Select where to book" page. Empty string when not exposed. */
    bookingToken: string;
    /** Per-flight carrier links as Google renders them. */
    carrierLinks: CarrierLink[];
    /** Matched from top-level carrier baggage metadata when possible. */
    baggageLinks: CarrierLink[];
}
interface FlightsSearchResult {
    flights: FlightResult[];
    metadata: {
        airlines: AirlineMetadata[];
        alliances: AllianceMetadata[];
        baggageLinks: CarrierLink[];
        locations: LocationMetadata[];
        flexibleDateInsight: FlexibleDateInsight | null;
    };
}
declare function parseFlightsPayload(payload: unknown[], options?: {
    includeSecondarySection?: boolean;
}): FlightsSearchResult;
declare function parseRpcResponse(text: string): FlightsSearchResult;
declare function parseFlightsHtml(html: string): FlightsSearchResult;

interface SessionCacheOptions {
    maxEntries?: number;
    ttlMs?: number;
}
declare class SessionCache {
    readonly maxEntries: number;
    readonly ttlMs: number;
    private readonly entries;
    constructor(options?: SessionCacheOptions);
    get(key: string): Promise<FlightsSearchResult> | undefined;
    set(key: string, value: Promise<FlightsSearchResult>): Promise<FlightsSearchResult>;
    clear(): void;
    size(): number;
    private evictExpired;
    private evictOverflow;
}
declare const defaultSessionCache: SessionCache;

declare class QueryValidationError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
declare class FetchFlightsError extends Error {
    readonly status?: number;
    readonly statusText?: string;
    readonly url?: string;
    constructor(message: string, options?: ErrorOptions & {
        status?: number;
        statusText?: string;
        url?: string;
    });
}
declare class HttpError extends FetchFlightsError {
    constructor(message: string, options: ErrorOptions & {
        status: number;
        statusText?: string;
        url?: string;
    });
}
declare class RateLimitError extends HttpError {
    constructor(message: string, options?: ErrorOptions & {
        status?: number;
        statusText?: string;
        url?: string;
    });
}
declare class TimeoutError extends FetchFlightsError {
    constructor(message: string, options?: ErrorOptions & {
        url?: string;
    });
}
declare class ParseFlightsError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
declare class CaptchaError extends ParseFlightsError {
    constructor(message: string, options?: ErrorOptions);
}

type ProxyResolver = string | (() => string | Promise<string>);
type TransportMode = "html" | "rpc" | "auto";
interface RetryOptions {
    /** Max retry attempts after the initial try. 0 disables retry (default). */
    attempts?: number;
    /** Base delay for exponential backoff, in ms. Defaults to 500. */
    baseDelayMs?: number;
    /** Upper bound on a single backoff delay, in ms. Defaults to 10_000. */
    maxDelayMs?: number;
    /** Decide whether to retry a given error/attempt. Default retries on 429, 5xx, network errors, and timeouts. */
    shouldRetry?: (error: FetchFlightsError, attempt: number) => boolean;
}
interface RequestTelemetry {
    attempt: number;
    transport: Exclude<TransportMode, "auto">;
    url: string;
    proxy?: string;
}
interface ResponseTelemetry extends RequestTelemetry {
    status: number;
    ok: boolean;
    bytes: number;
}
interface ParseErrorTelemetry {
    transport: Exclude<TransportMode, "auto">;
    error: Error;
}
interface CacheTelemetry {
    key: string;
}
interface FetchFlightsOptions {
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
    /** Which transport to use. Defaults to `auto` for structured queries and `html` for free-text queries. `auto` tries RPC first, then falls back to HTML. */
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
declare function fetchFlightsHtml(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<string>;
declare function fetchFlightsRpcText(input: StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<string>;
declare function clearSessionCache(): void;
declare function fetchFlights(input: string | StructuredQueryInput | EncodedQuery, options?: FetchFlightsOptions): Promise<FlightsSearchResult>;

interface SweepEntry {
    input: StructuredQueryInput;
    result?: FlightsSearchResult;
    error?: Error;
    startedAt: number;
    finishedAt: number;
}
interface SweepOptions extends FetchFlightsOptions {
    /** Max in-flight queries. Defaults to 3. */
    concurrency?: number;
    /** Minimum delay between consecutive query starts across all workers, in ms. Defaults to 0. */
    minDelayMs?: number;
    /** Called as each query settles. */
    onResult?: (entry: SweepEntry, index: number) => void;
}
declare class SweepRun implements AsyncIterable<SweepEntry>, PromiseLike<SweepEntry[]> {
    private readonly queue;
    private readonly waiters;
    private closed;
    private donePromise;
    setDonePromise(donePromise: Promise<SweepEntry[]>): void;
    push(entry: SweepEntry): void;
    close(): void;
    then<TResult1 = SweepEntry[], TResult2 = never>(onfulfilled?: ((value: SweepEntry[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<SweepEntry[] | TResult>;
    finally(onfinally?: (() => void) | null): Promise<SweepEntry[]>;
    [Symbol.asyncIterator](): AsyncIterator<SweepEntry>;
}
declare function sweepFlights(queries: StructuredQueryInput[], options?: SweepOptions): SweepRun;

interface LocationIndexEntry {
    code: string;
    cityCode: string;
    cityName: string;
    airports: string[];
}
declare function createLocationIndex(locations: LocationMetadata[]): Map<string, LocationIndexEntry>;
declare function expandLocationCode(code: string, locations: LocationMetadata[] | Map<string, LocationIndexEntry>): string[];

declare const simpleDateSchema: z.ZodObject<{
    year: z.ZodNumber;
    month: z.ZodNumber;
    day: z.ZodNumber;
}, z.core.$strip>;
declare const simpleTimeSchema: z.ZodObject<{
    hour: z.ZodNumber;
    minute: z.ZodNumber;
}, z.core.$strip>;
declare const flightTimestampSchema: z.ZodObject<{
    date: z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
        day: z.ZodNumber;
    }, z.core.$strip>;
    time: z.ZodObject<{
        hour: z.ZodNumber;
        minute: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const airportSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
declare const flightSegmentSchema: z.ZodObject<{
    fromAirport: z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    toAirport: z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    departure: z.ZodObject<{
        date: z.ZodObject<{
            year: z.ZodNumber;
            month: z.ZodNumber;
            day: z.ZodNumber;
        }, z.core.$strip>;
        time: z.ZodObject<{
            hour: z.ZodNumber;
            minute: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
    arrival: z.ZodObject<{
        date: z.ZodObject<{
            year: z.ZodNumber;
            month: z.ZodNumber;
            day: z.ZodNumber;
        }, z.core.$strip>;
        time: z.ZodObject<{
            hour: z.ZodNumber;
            minute: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
    durationMinutes: z.ZodNumber;
    planeType: z.ZodString;
    operatingCarrier: z.ZodString;
    flightNumber: z.ZodString;
    legroom: z.ZodString;
}, z.core.$strip>;
declare const layoverSchema: z.ZodObject<{
    durationMinutes: z.ZodNumber;
    airportCode: z.ZodString;
    airportName: z.ZodString;
    cityName: z.ZodString;
    changeOfAirport: z.ZodBoolean;
}, z.core.$strip>;
declare const carrierLinkSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        support: "support";
        baggage: "baggage";
    }>>;
}, z.core.$strip>;
declare const carbonEmissionSchema: z.ZodObject<{
    emission: z.ZodNumber;
    typicalOnRoute: z.ZodNumber;
}, z.core.$strip>;
declare const farePolicySchema: z.ZodObject<{
    refundabilityCode: z.ZodNullable<z.ZodNumber>;
    checkedBaggageIncluded: z.ZodNullable<z.ZodBoolean>;
}, z.core.$strip>;
declare const flexibleDatePricePointSchema: z.ZodObject<{
    epochMs: z.ZodNumber;
    date: z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
        day: z.ZodNumber;
    }, z.core.$strip>;
    price: z.ZodNumber;
}, z.core.$strip>;
declare const flexibleDateInsightSchema: z.ZodObject<{
    destinationLabel: z.ZodString;
    cheapestPrice: z.ZodNullable<z.ZodNumber>;
    highestPrice: z.ZodNullable<z.ZodNumber>;
    pricePoints: z.ZodArray<z.ZodObject<{
        epochMs: z.ZodNumber;
        date: z.ZodObject<{
            year: z.ZodNumber;
            month: z.ZodNumber;
            day: z.ZodNumber;
        }, z.core.$strip>;
        price: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const locationMetadataSchema: z.ZodObject<{
    code: z.ZodString;
    kind: z.ZodEnum<{
        airport: "airport";
        city: "city";
        place: "place";
    }>;
    name: z.ZodString;
    cityName: z.ZodString;
    cityCode: z.ZodString;
    countryCode: z.ZodString;
    countryName: z.ZodString;
}, z.core.$strip>;
declare const airlineMetadataSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
declare const allianceMetadataSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
declare const flightResultSchema: z.ZodObject<{
    type: z.ZodString;
    price: z.ZodNumber;
    airlines: z.ZodArray<z.ZodString>;
    segments: z.ZodArray<z.ZodObject<{
        fromAirport: z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>;
        toAirport: z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>;
        departure: z.ZodObject<{
            date: z.ZodObject<{
                year: z.ZodNumber;
                month: z.ZodNumber;
                day: z.ZodNumber;
            }, z.core.$strip>;
            time: z.ZodObject<{
                hour: z.ZodNumber;
                minute: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>;
        arrival: z.ZodObject<{
            date: z.ZodObject<{
                year: z.ZodNumber;
                month: z.ZodNumber;
                day: z.ZodNumber;
            }, z.core.$strip>;
            time: z.ZodObject<{
                hour: z.ZodNumber;
                minute: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>;
        durationMinutes: z.ZodNumber;
        planeType: z.ZodString;
        operatingCarrier: z.ZodString;
        flightNumber: z.ZodString;
        legroom: z.ZodString;
    }, z.core.$strip>>;
    totalDurationMinutes: z.ZodNumber;
    stopCount: z.ZodNumber;
    layovers: z.ZodArray<z.ZodObject<{
        durationMinutes: z.ZodNumber;
        airportCode: z.ZodString;
        airportName: z.ZodString;
        cityName: z.ZodString;
        changeOfAirport: z.ZodBoolean;
    }, z.core.$strip>>;
    carbon: z.ZodObject<{
        emission: z.ZodNumber;
        typicalOnRoute: z.ZodNumber;
    }, z.core.$strip>;
    farePolicy: z.ZodObject<{
        refundabilityCode: z.ZodNullable<z.ZodNumber>;
        checkedBaggageIncluded: z.ZodNullable<z.ZodBoolean>;
    }, z.core.$strip>;
    bookingToken: z.ZodString;
    carrierLinks: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        url: z.ZodString;
        type: z.ZodOptional<z.ZodEnum<{
            support: "support";
            baggage: "baggage";
        }>>;
    }, z.core.$strip>>;
    baggageLinks: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        url: z.ZodString;
        type: z.ZodOptional<z.ZodEnum<{
            support: "support";
            baggage: "baggage";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const flightsSearchResultSchema: z.ZodObject<{
    flights: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        price: z.ZodNumber;
        airlines: z.ZodArray<z.ZodString>;
        segments: z.ZodArray<z.ZodObject<{
            fromAirport: z.ZodObject<{
                code: z.ZodString;
                name: z.ZodString;
            }, z.core.$strip>;
            toAirport: z.ZodObject<{
                code: z.ZodString;
                name: z.ZodString;
            }, z.core.$strip>;
            departure: z.ZodObject<{
                date: z.ZodObject<{
                    year: z.ZodNumber;
                    month: z.ZodNumber;
                    day: z.ZodNumber;
                }, z.core.$strip>;
                time: z.ZodObject<{
                    hour: z.ZodNumber;
                    minute: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>;
            arrival: z.ZodObject<{
                date: z.ZodObject<{
                    year: z.ZodNumber;
                    month: z.ZodNumber;
                    day: z.ZodNumber;
                }, z.core.$strip>;
                time: z.ZodObject<{
                    hour: z.ZodNumber;
                    minute: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>;
            durationMinutes: z.ZodNumber;
            planeType: z.ZodString;
            operatingCarrier: z.ZodString;
            flightNumber: z.ZodString;
            legroom: z.ZodString;
        }, z.core.$strip>>;
        totalDurationMinutes: z.ZodNumber;
        stopCount: z.ZodNumber;
        layovers: z.ZodArray<z.ZodObject<{
            durationMinutes: z.ZodNumber;
            airportCode: z.ZodString;
            airportName: z.ZodString;
            cityName: z.ZodString;
            changeOfAirport: z.ZodBoolean;
        }, z.core.$strip>>;
        carbon: z.ZodObject<{
            emission: z.ZodNumber;
            typicalOnRoute: z.ZodNumber;
        }, z.core.$strip>;
        farePolicy: z.ZodObject<{
            refundabilityCode: z.ZodNullable<z.ZodNumber>;
            checkedBaggageIncluded: z.ZodNullable<z.ZodBoolean>;
        }, z.core.$strip>;
        bookingToken: z.ZodString;
        carrierLinks: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            type: z.ZodOptional<z.ZodEnum<{
                support: "support";
                baggage: "baggage";
            }>>;
        }, z.core.$strip>>;
        baggageLinks: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            type: z.ZodOptional<z.ZodEnum<{
                support: "support";
                baggage: "baggage";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    metadata: z.ZodObject<{
        airlines: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>>;
        alliances: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>>;
        baggageLinks: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            type: z.ZodOptional<z.ZodEnum<{
                support: "support";
                baggage: "baggage";
            }>>;
        }, z.core.$strip>>;
        locations: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            kind: z.ZodEnum<{
                airport: "airport";
                city: "city";
                place: "place";
            }>;
            name: z.ZodString;
            cityName: z.ZodString;
            cityCode: z.ZodString;
            countryCode: z.ZodString;
            countryName: z.ZodString;
        }, z.core.$strip>>;
        flexibleDateInsight: z.ZodNullable<z.ZodObject<{
            destinationLabel: z.ZodString;
            cheapestPrice: z.ZodNullable<z.ZodNumber>;
            highestPrice: z.ZodNullable<z.ZodNumber>;
            pricePoints: z.ZodArray<z.ZodObject<{
                epochMs: z.ZodNumber;
                date: z.ZodObject<{
                    year: z.ZodNumber;
                    month: z.ZodNumber;
                    day: z.ZodNumber;
                }, z.core.$strip>;
                price: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;

export { type AirlineMetadata, type Airport, type AllianceMetadata, type CacheTelemetry, CaptchaError, type CarbonEmission, type CarrierLink, type CarrierResourceType, type ConnectionAirportFilter, type EncodedQuery, type FarePolicy, FetchFlightsError, type FetchFlightsOptions, type FlexibleDateInsight, type FlexibleDatePricePoint, type FlightQueryInput, type FlightResult, type FlightSegment, type FlightTimestamp, type FlightsSearchResult, HttpError, type Layover, type LayoverFilter, type LocationIndexEntry, type LocationMetadata, type ParseErrorTelemetry, ParseFlightsError, type PassengerCounts, type PostSearchFilters, type ProxyResolver, QueryValidationError, RateLimitError, type RequestTelemetry, type ResponseTelemetry, type RetryOptions, type SeatType, SessionCache, type SessionCacheOptions, type SimpleDate, type SimpleTime, type StructuredQueryInput, type SweepEntry, type SweepOptions, SweepRun, type TimeWindow, TimeoutError, type TripType, airlineMetadataSchema, airportSchema, allianceMetadataSchema, buildSearchUrl, carbonEmissionSchema, carrierLinkSchema, clearSessionCache, createLocationIndex, createQuery, decodeQuery, defaultSessionCache, expandLocationCode, farePolicySchema, fetchFlights, fetchFlightsHtml, fetchFlightsRpcText, flexibleDateInsightSchema, flexibleDatePricePointSchema, flightResultSchema, flightSegmentSchema, flightTimestampSchema, flightsSearchResultSchema, layoverSchema, locationMetadataSchema, parseFlightsHtml, parseFlightsPayload, parseRpcResponse, simpleDateSchema, simpleTimeSchema, sweepFlights };
