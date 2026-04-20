import { runInNewContext } from "node:vm";

import { CaptchaError, ParseFlightsError } from "./errors.js";

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

export type CarrierResourceType = "support" | "baggage";

export interface CarrierLink {
  code: string;
  name: string;
  /** Carrier-provided URL that Google associates with this flight. May be support/accessibility rather than a direct booking page. */
  url: string;
  type?: CarrierResourceType;
}

export interface CarbonEmission {
  /** Estimated CO2 emissions for this itinerary, in grams. */
  emission: number;
  /** Typical CO2 emissions for this route, in grams. */
  typicalOnRoute: number;
}

export interface FarePolicy {
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

export interface FlexibleDatePricePoint {
  epochMs: number;
  date: SimpleDate;
  price: number;
}

export interface FlexibleDateInsight {
  destinationLabel: string;
  cheapestPrice: number | null;
  highestPrice: number | null;
  pricePoints: FlexibleDatePricePoint[];
}

export interface LocationMetadata {
  code: string;
  kind: "airport" | "city" | "place";
  name: string;
  cityName: string;
  cityCode: string;
  countryCode: string;
  countryName: string;
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
  farePolicy: FarePolicy;
  /** Opaque token Google re-submits to open the "Select where to book" page. Empty string when not exposed. */
  bookingToken: string;
  /** Per-flight carrier links as Google renders them. */
  carrierLinks: CarrierLink[];
  /** Matched from top-level carrier baggage metadata when possible. */
  baggageLinks: CarrierLink[];
}

export interface FlightsSearchResult {
  flights: FlightResult[];
  metadata: {
    airlines: AirlineMetadata[];
    alliances: AllianceMetadata[];
    baggageLinks: CarrierLink[];
    locations: LocationMetadata[];
    flexibleDateInsight: FlexibleDateInsight | null;
  };
}

type CallbackChunk = {
  key?: string;
  data?: unknown;
};

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  return isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readPrice(value: unknown): number | null {
  const pricing = isArray(value) ? value : [];
  const primary = isArray(pricing[0]) ? pricing[0] : [];
  const price = primary[1];

  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

function toDate(value: unknown): SimpleDate {
  const date = isArray(value) ? value : [];

  return {
    year: toNumber(date[0]),
    month: toNumber(date[1]),
    day: toNumber(date[2])
  };
}

function toTime(value: unknown): SimpleTime {
  const time = isArray(value) ? value : [];

  return {
    hour: toNumber(time[0]),
    minute: toNumber(time[1])
  };
}

function epochMsToDate(epochMs: number): SimpleDate {
  const date = new Date(epochMs);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

const DS1_MARKERS = ["AF_initDataCallback({key: 'ds:1'", 'AF_initDataCallback({key:"ds:1"'];
const SCRIPT_TAG = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const CAPTCHA_MARKERS = [
  "Our systems have detected unusual traffic",
  "recaptcha",
  "g-recaptcha",
  "/sorry/index"
];

function looksLikeCaptchaPage(html: string): boolean {
  return CAPTCHA_MARKERS.some((marker) => html.includes(marker));
}

function extractDs1Script(html: string): string {
  const hasMarker = DS1_MARKERS.some((marker) => html.includes(marker));

  if (!hasMarker) {
    if (looksLikeCaptchaPage(html)) {
      throw new CaptchaError("Google returned an anti-bot / CAPTCHA page instead of flight results.");
    }
    throw new ParseFlightsError("Could not find the ds:1 bootstrap payload in the Google Flights HTML.");
  }

  SCRIPT_TAG.lastIndex = 0;
  for (let match = SCRIPT_TAG.exec(html); match !== null; match = SCRIPT_TAG.exec(html)) {
    const script = match[1] ?? "";
    if (DS1_MARKERS.some((marker) => script.includes(marker))) {
      return script;
    }
  }

  throw new ParseFlightsError("Could not find the ds:1 bootstrap payload in the Google Flights HTML.");
}

function evaluateDs1Script(script: string): unknown[] {
  let chunk: CallbackChunk | undefined;

  try {
    runInNewContext(script, {
      AF_initDataCallback: (value: CallbackChunk) => {
        chunk = value;
      }
    }, {
      timeout: 100
    });
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to evaluate the ds:1 script: ${(error as Error).message ?? String(error)}`,
      { cause: error }
    );
  }

  if (!chunk || !isArray(chunk.data)) {
    throw new ParseFlightsError("The ds:1 script did not expose an array payload.");
  }

  return chunk.data;
}

function parseSegment(rawSegment: unknown): FlightSegment {
  const segment = isArray(rawSegment) ? rawSegment : [];
  const carrierInfo = isArray(segment[22]) ? segment[22] : [];
  const operatingCarrier = toString(carrierInfo[0]);
  const flightNumberDigits = toString(carrierInfo[1]);
  const flightNumber = operatingCarrier !== "" && flightNumberDigits !== ""
    ? `${operatingCarrier}${flightNumberDigits}`
    : "";

  return {
    fromAirport: {
      code: toString(segment[3]),
      name: toString(segment[4])
    },
    toAirport: {
      code: toString(segment[6]),
      name: toString(segment[5])
    },
    departure: {
      date: toDate(segment[20]),
      time: toTime(segment[8])
    },
    arrival: {
      date: toDate(segment[21]),
      time: toTime(segment[10])
    },
    durationMinutes: toNumber(segment[11]),
    planeType: toString(segment[17]),
    operatingCarrier,
    flightNumber,
    legroom: toString(segment[14])
  };
}

function parseLayover(rawLayover: unknown): Layover {
  const layover = isArray(rawLayover) ? rawLayover : [];
  const arrivalCode = toString(layover[1]);
  const onwardCode = toString(layover[2], arrivalCode);

  return {
    durationMinutes: toNumber(layover[0]),
    airportCode: arrivalCode,
    airportName: toString(layover[4]),
    cityName: toString(layover[5]),
    changeOfAirport: arrivalCode !== "" && onwardCode !== "" && arrivalCode !== onwardCode
  };
}

function parseCarrierLink(rawEntry: unknown, type?: CarrierResourceType): CarrierLink | null {
  const entry = isArray(rawEntry) ? rawEntry : [];
  const code = toString(entry[0]);

  if (code === "") {
    return null;
  }

  const link: CarrierLink = {
    code,
    name: toString(entry[1]),
    url: toString(entry[2])
  };

  if (type) {
    link.type = type;
  }

  return link;
}

function parseFarePolicy(extras: unknown[]): FarePolicy {
  const baggageHint = isArray(extras[9]) ? extras[9] : null;

  return {
    refundabilityCode: toNullableNumber(extras[15]),
    checkedBaggageIncluded: baggageHint === null ? null : baggageHint.some((value) => toNumber(value) > 0)
  };
}

function parseLocationRow(rawRow: unknown): LocationMetadata | null {
  const row = isArray(rawRow) ? rawRow : [];
  const codeRoot = isArray(row[0]) ? row[0] : [];
  const info = isArray(row[2]) ? row[2] : [];
  const rowCode = toString(codeRoot[0]);
  const rowType = toNumber(codeRoot[1], 0);
  const countryCode = toString(row[4]);
  const countryName = toString(row[6]);
  const cityName = toString(info[1], toString(row[1]));
  const cityCode = toString(info[5], rowCode);

  if (rowCode === "" && cityCode === "") {
    return null;
  }

  const code = rowCode !== "" && !rowCode.startsWith("/") ? rowCode : cityCode;
  const kind: LocationMetadata["kind"] = rowCode.startsWith("/")
    ? "city"
    : rowType === 0
      ? "airport"
      : "place";

  return {
    code,
    kind,
    name: toString(row[1], cityName || code),
    cityName,
    cityCode,
    countryCode,
    countryName
  };
}

function parseFlexibleDateInsight(payload: unknown[]): FlexibleDateInsight | null {
  const insightRoot = isArray(payload[5]) ? payload[5] : [];
  const rawPoints = isArray(insightRoot[10]) && isArray(insightRoot[10][0]) ? insightRoot[10][0] : [];
  const destinationLabel = toString(insightRoot[12]);

  const pricePoints = rawPoints
    .filter(isArray)
    .map((point) => {
      const epochMs = toNumber(point[0]);
      const price = toNumber(point[1]);

      if (epochMs <= 0 || price <= 0) {
        return null;
      }

      return {
        epochMs,
        date: epochMsToDate(epochMs),
        price
      };
    })
    .filter((point): point is FlexibleDatePricePoint => point !== null);

  if (pricePoints.length === 0) {
    return null;
  }

  const prices = pricePoints.map((point) => point.price);

  return {
    destinationLabel,
    cheapestPrice: Math.min(...prices),
    highestPrice: Math.max(...prices),
    pricePoints
  };
}

function parseMetadata(payload: unknown[]): FlightsSearchResult["metadata"] {
  const metadataRoot = isArray(payload[7]) ? payload[7] : [];
  const carrierRoot = isArray(metadataRoot[1]) ? metadataRoot[1] : [];
  const allianceRows = isArray(carrierRoot[0]) ? carrierRoot[0] : [];
  const airlineRows = isArray(carrierRoot[1]) ? carrierRoot[1] : [];
  const baggageRows = isArray(payload[11]) ? payload[11] : [];
  const locationRows = isArray(payload[17]) ? payload[17] : [];

  return {
    alliances: allianceRows
      .filter(isArray)
      .map((row) => ({
        code: toString(row[0]),
        name: toString(row[1])
      }))
      .filter((row) => row.code !== "" && row.name !== ""),
    airlines: airlineRows
      .filter(isArray)
      .map((row) => ({
        code: toString(row[0]),
        name: toString(row[1])
      }))
      .filter((row) => row.code !== "" && row.name !== ""),
    baggageLinks: baggageRows
      .map((row) => parseCarrierLink(row, "baggage"))
      .filter((row): row is CarrierLink => row !== null),
    locations: locationRows
      .map(parseLocationRow)
      .filter((row): row is LocationMetadata => row !== null),
    flexibleDateInsight: parseFlexibleDateInsight(payload)
  };
}

function buildBaggageLinkMap(links: CarrierLink[]): Map<string, CarrierLink[]> {
  const map = new Map<string, CarrierLink[]>();

  for (const link of links) {
    const current = map.get(link.code) ?? [];
    current.push(link);
    map.set(link.code, current);
  }

  return map;
}

function parseFlightResult(rawItem: unknown, baggageLinksByCode: Map<string, CarrierLink[]>): FlightResult | null {
  const item = isArray(rawItem) ? rawItem : [];
  const flight = isArray(item[0]) ? item[0] : null;

  if (!flight) {
    return null;
  }

  const pricing = isArray(item[1]) ? item[1] : [];
  const price = readPrice(item[1]);
  const bookingToken = toString(pricing[1]);
  const segments = isArray(flight[2]) ? flight[2].map(parseSegment) : [];
  const layovers = isArray(flight[13]) ? flight[13].map(parseLayover) : [];
  const extras = isArray(flight[22]) ? flight[22] : [];
  const carrierLinks = (isArray(flight[24]) ? flight[24] : [])
    .map((entry) => parseCarrierLink(entry, "support"))
    .filter((entry): entry is CarrierLink => entry !== null);

  if (price === null || segments.length === 0) {
    return null;
  }

  const airlineCodes = new Set<string>();
  for (const segment of segments) {
    if (segment.operatingCarrier !== "") {
      airlineCodes.add(segment.operatingCarrier);
    }
  }

  const baggageLinks = Array.from(airlineCodes)
    .flatMap((code) => baggageLinksByCode.get(code) ?? []);

  return {
    type: toString(flight[0]),
    price,
    airlines: toStringArray(flight[1]),
    segments,
    totalDurationMinutes: toNumber(flight[9]),
    stopCount: toNumber(flight[10]),
    layovers,
    carbon: {
      emission: toNumber(extras[7]),
      typicalOnRoute: toNumber(extras[8])
    },
    farePolicy: parseFarePolicy(extras),
    bookingToken,
    carrierLinks,
    baggageLinks
  };
}

function collectFlightSections(payload: unknown[], includeSecondarySection: boolean): unknown[] {
  const sections = [payload[3], ...(includeSecondarySection ? [payload[2]] : [])]
    .filter(isArray)
    .flatMap((section) => (isArray(section[0]) ? section[0] : []));

  return sections;
}

function dedupeFlights(flights: FlightResult[]): FlightResult[] {
  const seen = new Set<string>();
  const deduped: FlightResult[] = [];

  for (const flight of flights) {
    const key = flight.bookingToken !== ""
      ? `token:${flight.bookingToken}`
      : `segments:${flight.segments.map((segment) => `${segment.flightNumber}:${segment.departure.date.year}-${segment.departure.date.month}-${segment.departure.date.day}:${segment.departure.time.hour}:${segment.departure.time.minute}`).join("|")}:${flight.price}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(flight);
  }

  return deduped;
}

export function parseFlightsPayload(payload: unknown[], options: { includeSecondarySection?: boolean } = {}): FlightsSearchResult {
  if (!isArray(payload)) {
    throw new ParseFlightsError("Expected Google Flights payload to be an array.");
  }

  const metadata = parseMetadata(payload);
  const baggageLinksByCode = buildBaggageLinkMap(metadata.baggageLinks);
  const flights = dedupeFlights(
    collectFlightSections(payload, options.includeSecondarySection ?? false)
      .map((rawItem) => parseFlightResult(rawItem, baggageLinksByCode))
      .filter((flight): flight is FlightResult => flight !== null)
  );

  return {
    flights,
    metadata
  };
}

export function parseRpcResponse(text: string): FlightsSearchResult {
  const stripped = text.replace(/^\)\]\}'?\s*/, "");

  if (stripped.trim() === "") {
    throw new ParseFlightsError("Google Flights returned an empty RPC response.");
  }

  let outer: unknown;
  try {
    outer = JSON.parse(stripped);
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to parse Google Flights RPC envelope: ${(error as Error).message ?? String(error)}`,
      { cause: error }
    );
  }

  const innerJson = isArray(outer) && isArray(outer[0]) ? outer[0][2] : undefined;
  if (typeof innerJson !== "string") {
    throw new ParseFlightsError("Google Flights RPC response did not contain flight data at [0][2].");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(innerJson);
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to parse Google Flights RPC payload: ${(error as Error).message ?? String(error)}`,
      { cause: error }
    );
  }

  if (!isArray(payload)) {
    throw new ParseFlightsError("Google Flights RPC payload was not an array.");
  }

  return parseFlightsPayload(payload, { includeSecondarySection: true });
}

export function parseFlightsHtml(html: string): FlightsSearchResult {
  if (looksLikeCaptchaPage(html)) {
    throw new CaptchaError("Google returned an anti-bot / CAPTCHA page instead of flight results.");
  }
  const script = extractDs1Script(html);
  const payload = evaluateDs1Script(script);
  return parseFlightsPayload(payload);
}
