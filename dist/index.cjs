"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CaptchaError: () => CaptchaError,
  FetchFlightsError: () => FetchFlightsError,
  HttpError: () => HttpError,
  ParseFlightsError: () => ParseFlightsError,
  QueryValidationError: () => QueryValidationError,
  RateLimitError: () => RateLimitError,
  SessionCache: () => SessionCache,
  SweepRun: () => SweepRun,
  TimeoutError: () => TimeoutError,
  airlineMetadataSchema: () => airlineMetadataSchema,
  airportSchema: () => airportSchema,
  allianceMetadataSchema: () => allianceMetadataSchema,
  buildSearchUrl: () => buildSearchUrl,
  carbonEmissionSchema: () => carbonEmissionSchema,
  carrierLinkSchema: () => carrierLinkSchema,
  clearSessionCache: () => clearSessionCache,
  createLocationIndex: () => createLocationIndex,
  createQuery: () => createQuery,
  decodeQuery: () => decodeQuery,
  defaultSessionCache: () => defaultSessionCache,
  expandLocationCode: () => expandLocationCode,
  farePolicySchema: () => farePolicySchema,
  fetchFlights: () => fetchFlights,
  fetchFlightsHtml: () => fetchFlightsHtml,
  fetchFlightsRpcText: () => fetchFlightsRpcText,
  flexibleDateInsightSchema: () => flexibleDateInsightSchema,
  flexibleDatePricePointSchema: () => flexibleDatePricePointSchema,
  flightResultSchema: () => flightResultSchema,
  flightSegmentSchema: () => flightSegmentSchema,
  flightTimestampSchema: () => flightTimestampSchema,
  flightsSearchResultSchema: () => flightsSearchResultSchema,
  layoverSchema: () => layoverSchema,
  locationMetadataSchema: () => locationMetadataSchema,
  parseFlightsHtml: () => parseFlightsHtml,
  parseFlightsPayload: () => parseFlightsPayload,
  parseRpcResponse: () => parseRpcResponse,
  simpleDateSchema: () => simpleDateSchema,
  simpleTimeSchema: () => simpleTimeSchema,
  sweepFlights: () => sweepFlights
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var QueryValidationError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "QueryValidationError";
  }
};
var FetchFlightsError = class extends Error {
  status;
  statusText;
  url;
  constructor(message, options) {
    super(message, options);
    this.name = "FetchFlightsError";
    if (options?.status !== void 0) {
      this.status = options.status;
    }
    if (options?.statusText !== void 0) {
      this.statusText = options.statusText;
    }
    if (options?.url !== void 0) {
      this.url = options.url;
    }
  }
};
var HttpError = class extends FetchFlightsError {
  constructor(message, options) {
    super(message, options);
    this.name = "HttpError";
  }
};
var RateLimitError = class extends HttpError {
  constructor(message, options = { status: 429 }) {
    super(message, { ...options, status: options.status ?? 429 });
    this.name = "RateLimitError";
  }
};
var TimeoutError = class extends FetchFlightsError {
  constructor(message, options) {
    super(message, options);
    this.name = "TimeoutError";
  }
};
var ParseFlightsError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ParseFlightsError";
  }
};
var CaptchaError = class extends ParseFlightsError {
  constructor(message, options) {
    super(message, options);
    this.name = "CaptchaError";
  }
};

// src/query.ts
var GOOGLE_FLIGHTS_SEARCH_URL = "https://www.google.com/travel/flights/search";
var TEXT_ENCODER = new TextEncoder();
var IATA_CODE = /^[A-Z]{3}$/;
var AIRLINE_FILTER = /^[A-Z0-9_]{2,32}$/;
var MAX_SAFE_VARINT = 2 ** 31 - 1;
var SEAT_ENUM = {
  economy: 1,
  "premium-economy": 2,
  business: 3,
  first: 4
};
var SEAT_REVERSE = {
  1: "economy",
  2: "premium-economy",
  3: "business",
  4: "first"
};
var TRIP_ENUM = {
  "round-trip": 1,
  "one-way": 2,
  "multi-city": 3
};
var TRIP_REVERSE = {
  1: "round-trip",
  2: "one-way",
  3: "multi-city"
};
var PASSENGER_ENUM = {
  adult: 1,
  child: 2,
  infantInSeat: 3,
  infantOnLap: 4
};
var TEXT_DECODER = new TextDecoder();
var ProtoWriter = class {
  chunks = [];
  writeTag(fieldNumber, wireType) {
    this.writeVarint(fieldNumber << 3 | wireType);
  }
  writeVarint(value) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_SAFE_VARINT) {
      throw new QueryValidationError(
        `Expected a non-negative integer varint within 31-bit range, received ${value}.`
      );
    }
    let remaining = value;
    while (remaining > 127) {
      this.chunks.push(remaining & 127 | 128);
      remaining >>>= 7;
    }
    this.chunks.push(remaining);
  }
  writeString(fieldNumber, value) {
    const bytes = TEXT_ENCODER.encode(value);
    this.writeTag(fieldNumber, 2 /* LengthDelimited */);
    this.writeVarint(bytes.length);
    this.writeRawBytes(bytes);
  }
  writeMessage(fieldNumber, bytes) {
    this.writeTag(fieldNumber, 2 /* LengthDelimited */);
    this.writeVarint(bytes.length);
    this.writeRawBytes(bytes);
  }
  writeEnum(fieldNumber, value) {
    this.writeTag(fieldNumber, 0 /* Varint */);
    this.writeVarint(value);
  }
  writeInt32(fieldNumber, value) {
    this.writeTag(fieldNumber, 0 /* Varint */);
    this.writeVarint(value);
  }
  writeRawBytes(bytes) {
    for (const byte of bytes) {
      this.chunks.push(byte);
    }
  }
  finish() {
    return Uint8Array.from(this.chunks);
  }
};
function normalizeAirportCode(value, fieldName) {
  const code = value.trim().toUpperCase();
  if (!IATA_CODE.test(code)) {
    throw new QueryValidationError(
      `${fieldName} must be a 3-letter IATA airport or city/metro code. Received "${value}".`
    );
  }
  return code;
}
function normalizeAirlineCode(value) {
  const code = value.trim().toUpperCase();
  if (!AIRLINE_FILTER.test(code)) {
    throw new QueryValidationError(
      `Airline filter must be an IATA airline code (e.g. "JL") or an alliance identifier (e.g. "STAR_ALLIANCE"). Received "${value}".`
    );
  }
  return code;
}
function normalizeCodeList(values, fieldName) {
  if (!values || values.length === 0) {
    return void 0;
  }
  return values.map((value) => normalizeAirportCode(value, fieldName));
}
function normalizeTimeWindow(window, fieldName) {
  if (!window) {
    return void 0;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(window)) {
    if (value === void 0) {
      continue;
    }
    const trimmed = value.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmed)) {
      throw new QueryValidationError(`${fieldName}.${key} must use HH:MM 24-hour format. Received "${value}".`);
    }
    const [hourText, minuteText] = trimmed.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new QueryValidationError(`${fieldName}.${key} must be a valid 24-hour time. Received "${value}".`);
    }
    normalized[key] = trimmed;
  }
  return Object.keys(normalized).length > 0 ? normalized : void 0;
}
function normalizeLayoverFilter(filter) {
  if (!filter) {
    return void 0;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === void 0) {
      continue;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new QueryValidationError(`filters.layover.${key} must be a non-negative integer. Received ${value}.`);
    }
    normalized[key] = value;
  }
  if (normalized.minMinutes !== void 0 && normalized.maxMinutes !== void 0 && normalized.minMinutes > normalized.maxMinutes) {
    throw new QueryValidationError("filters.layover.minMinutes cannot exceed filters.layover.maxMinutes.");
  }
  return Object.keys(normalized).length > 0 ? normalized : void 0;
}
function normalizeFilters(filters) {
  if (!filters) {
    return void 0;
  }
  const normalized = {};
  const departureTime = normalizeTimeWindow(filters.departureTime, "filters.departureTime");
  const arrivalTime = normalizeTimeWindow(filters.arrivalTime, "filters.arrivalTime");
  const layover = normalizeLayoverFilter(filters.layover);
  const allow = normalizeCodeList(filters.connectionAirports?.allow, "filters.connectionAirports.allow");
  const block = normalizeCodeList(filters.connectionAirports?.block, "filters.connectionAirports.block");
  if (departureTime) normalized.departureTime = departureTime;
  if (arrivalTime) normalized.arrivalTime = arrivalTime;
  if (layover) normalized.layover = layover;
  if (allow || block) {
    normalized.connectionAirports = {};
    if (allow) normalized.connectionAirports.allow = allow;
    if (block) normalized.connectionAirports.block = block;
  }
  return Object.keys(normalized).length > 0 ? normalized : void 0;
}
function normalizeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new QueryValidationError("Invalid Date passed for flight date.");
    }
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new QueryValidationError(`Dates must use YYYY-MM-DD format. Received "${value}".`);
  }
  return date;
}
function normalizeMaxStops(value, fieldName) {
  if (value === void 0) {
    return void 0;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new QueryValidationError(`${fieldName} must be a non-negative integer. Received ${value}.`);
  }
  return value;
}
function assertTripMatchesSegments(trip, segmentCount) {
  if (trip === "one-way" && segmentCount !== 1) {
    throw new QueryValidationError(
      `trip "one-way" requires exactly one flight segment (received ${segmentCount}).`
    );
  }
  if (trip === "round-trip" && segmentCount !== 2) {
    throw new QueryValidationError(
      `trip "round-trip" requires exactly two flight segments (received ${segmentCount}).`
    );
  }
  if (trip === "multi-city" && segmentCount < 2) {
    throw new QueryValidationError(
      `trip "multi-city" requires at least two flight segments (received ${segmentCount}).`
    );
  }
}
function buildPassengers(counts) {
  const adults = counts?.adults ?? 1;
  const children = counts?.children ?? 0;
  const infantsInSeat = counts?.infantsInSeat ?? 0;
  const infantsOnLap = counts?.infantsOnLap ?? 0;
  for (const [name, value] of Object.entries({ adults, children, infantsInSeat, infantsOnLap })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new QueryValidationError(`Passenger count "${name}" must be a non-negative integer.`);
    }
  }
  const total = adults + children + infantsInSeat + infantsOnLap;
  if (total < 1) {
    throw new QueryValidationError("At least one passenger is required.");
  }
  if (total > 9) {
    throw new QueryValidationError("Google Flights allows at most 9 passengers.");
  }
  if (infantsOnLap > adults) {
    throw new QueryValidationError("There must be at least one adult per infant on lap.");
  }
  return [
    ...Array.from({ length: adults }, () => PASSENGER_ENUM.adult),
    ...Array.from({ length: children }, () => PASSENGER_ENUM.child),
    ...Array.from({ length: infantsInSeat }, () => PASSENGER_ENUM.infantInSeat),
    ...Array.from({ length: infantsOnLap }, () => PASSENGER_ENUM.infantOnLap)
  ];
}
function encodeAirport(airportCode) {
  const writer = new ProtoWriter();
  writer.writeString(2, airportCode);
  return writer.finish();
}
function encodeFlightData(flight, inheritedMaxStops) {
  const writer = new ProtoWriter();
  const date = normalizeDate(flight.date);
  const fromAirport = normalizeAirportCode(flight.fromAirport, "fromAirport");
  const toAirport = normalizeAirportCode(flight.toAirport, "toAirport");
  const maxStops = normalizeMaxStops(flight.maxStops ?? inheritedMaxStops, "maxStops");
  writer.writeString(2, date);
  if (maxStops !== void 0) {
    writer.writeInt32(5, maxStops);
  }
  for (const airline of flight.airlines ?? []) {
    writer.writeString(6, normalizeAirlineCode(airline));
  }
  writer.writeMessage(13, encodeAirport(fromAirport));
  writer.writeMessage(14, encodeAirport(toAirport));
  return writer.finish();
}
function encodeInfo(input) {
  const writer = new ProtoWriter();
  const flights = input.flights;
  if (!Array.isArray(flights) || flights.length < 1) {
    throw new QueryValidationError("At least one flight segment is required.");
  }
  const trip = input.trip ?? "one-way";
  assertTripMatchesSegments(trip, flights.length);
  const passengers = buildPassengers(input.passengers);
  const seat = SEAT_ENUM[input.seat ?? "economy"];
  const tripValue = TRIP_ENUM[trip];
  const inheritedMaxStops = normalizeMaxStops(input.maxStops, "maxStops");
  for (const flight of flights) {
    writer.writeMessage(3, encodeFlightData(flight, inheritedMaxStops));
  }
  if (passengers.length > 0) {
    const passengerWriter = new ProtoWriter();
    for (const passenger of passengers) {
      passengerWriter.writeVarint(passenger);
    }
    writer.writeMessage(8, passengerWriter.finish());
  }
  writer.writeEnum(9, seat);
  writer.writeEnum(19, tripValue);
  return writer.finish();
}
function createQuery(input) {
  const encodedInfo = encodeInfo(input);
  const tfs = Buffer.from(encodedInfo).toString("base64");
  const language = input.language ?? "";
  const currency = input.currency ?? "";
  const region = input.region ?? "";
  void normalizeFilters(input.filters);
  const params = new URLSearchParams();
  params.set("tfs", tfs);
  if (language !== "") {
    params.set("hl", language);
  }
  if (currency !== "") {
    params.set("curr", currency);
  }
  if (region !== "") {
    params.set("gl", region);
  }
  return {
    tfs,
    language,
    currency,
    region,
    params,
    url: `${GOOGLE_FLIGHTS_SEARCH_URL}?${params.toString()}`
  };
}
function buildSearchUrl(input) {
  if (typeof input === "string") {
    const params = new URLSearchParams({ q: input });
    return `${GOOGLE_FLIGHTS_SEARCH_URL}?${params.toString()}`;
  }
  if ("tfs" in input) {
    return input.url;
  }
  return createQuery(input).url;
}
var ProtoReader = class {
  constructor(bytes) {
    this.bytes = bytes;
  }
  bytes;
  offset = 0;
  hasMore() {
    return this.offset < this.bytes.length;
  }
  readVarint() {
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.offset >= this.bytes.length) {
        throw new QueryValidationError("Truncated varint in tfs payload.");
      }
      const byte = this.bytes[this.offset++];
      result |= (byte & 127) << shift;
      if ((byte & 128) === 0) return result >>> 0;
      shift += 7;
      if (shift > 28) {
        throw new QueryValidationError("Varint exceeds 32-bit range in tfs payload.");
      }
    }
  }
  readTag() {
    const tag = this.readVarint();
    return { fieldNumber: tag >>> 3, wireType: tag & 7 };
  }
  readBytes() {
    const length = this.readVarint();
    if (this.offset + length > this.bytes.length) {
      throw new QueryValidationError("Truncated length-delimited field in tfs payload.");
    }
    const out = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }
  readString() {
    return TEXT_DECODER.decode(this.readBytes());
  }
  skip(wireType) {
    if (wireType === 0) this.readVarint();
    else if (wireType === 2) this.readBytes();
    else if (wireType === 1) this.offset += 8;
    else if (wireType === 5) this.offset += 4;
    else throw new QueryValidationError(`Unsupported wire type ${wireType} in tfs payload.`);
  }
};
function decodeAirport(bytes) {
  const reader = new ProtoReader(bytes);
  let code = "";
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 2 && wireType === 2) code = reader.readString();
    else reader.skip(wireType);
  }
  return code;
}
function decodeFlight(bytes) {
  const reader = new ProtoReader(bytes);
  let date = "";
  let maxStops;
  const airlines = [];
  let fromAirport = "";
  let toAirport = "";
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 2 && wireType === 2) date = reader.readString();
    else if (fieldNumber === 5 && wireType === 0) maxStops = reader.readVarint();
    else if (fieldNumber === 6 && wireType === 2) airlines.push(reader.readString());
    else if (fieldNumber === 13 && wireType === 2) fromAirport = decodeAirport(reader.readBytes());
    else if (fieldNumber === 14 && wireType === 2) toAirport = decodeAirport(reader.readBytes());
    else reader.skip(wireType);
  }
  const flight = { date, fromAirport, toAirport };
  if (maxStops !== void 0) flight.maxStops = maxStops;
  if (airlines.length > 0) flight.airlines = airlines;
  return flight;
}
function decodePassengers(bytes) {
  const reader = new ProtoReader(bytes);
  let adults = 0;
  let children = 0;
  let infantsInSeat = 0;
  let infantsOnLap = 0;
  while (reader.hasMore()) {
    const value = reader.readVarint();
    if (value === PASSENGER_ENUM.adult) adults++;
    else if (value === PASSENGER_ENUM.child) children++;
    else if (value === PASSENGER_ENUM.infantInSeat) infantsInSeat++;
    else if (value === PASSENGER_ENUM.infantOnLap) infantsOnLap++;
  }
  const counts = {};
  if (adults > 0) counts.adults = adults;
  if (children > 0) counts.children = children;
  if (infantsInSeat > 0) counts.infantsInSeat = infantsInSeat;
  if (infantsOnLap > 0) counts.infantsOnLap = infantsOnLap;
  return counts;
}
function decodeQuery(tfs) {
  if (typeof tfs !== "string" || tfs.length === 0) {
    throw new QueryValidationError("decodeQuery requires a non-empty base64 tfs string.");
  }
  let bytes;
  try {
    bytes = Uint8Array.from(Buffer.from(tfs, "base64"));
  } catch (error) {
    throw new QueryValidationError(`Invalid base64 in tfs: ${error.message ?? String(error)}`, {
      cause: error
    });
  }
  const reader = new ProtoReader(bytes);
  const flights = [];
  let passengers;
  let seat;
  let trip;
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 3 && wireType === 2) flights.push(decodeFlight(reader.readBytes()));
    else if (fieldNumber === 8 && wireType === 2) passengers = decodePassengers(reader.readBytes());
    else if (fieldNumber === 9 && wireType === 0) seat = SEAT_REVERSE[reader.readVarint()];
    else if (fieldNumber === 19 && wireType === 0) trip = TRIP_REVERSE[reader.readVarint()];
    else reader.skip(wireType);
  }
  if (flights.length === 0) {
    throw new QueryValidationError("Decoded tfs payload contained no flight segments.");
  }
  const result = { flights };
  if (passengers !== void 0) result.passengers = passengers;
  if (seat !== void 0) result.seat = seat;
  if (trip !== void 0) result.trip = trip;
  return result;
}

// src/parse.ts
var import_node_vm = require("vm");
function isArray(value) {
  return Array.isArray(value);
}
function toNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function toNullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function toString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function toStringArray(value) {
  return isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function readPrice(value) {
  const pricing = isArray(value) ? value : [];
  const primary = isArray(pricing[0]) ? pricing[0] : [];
  const price = primary[1];
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}
function toDate(value) {
  const date = isArray(value) ? value : [];
  return {
    year: toNumber(date[0]),
    month: toNumber(date[1]),
    day: toNumber(date[2])
  };
}
function toTime(value) {
  const time = isArray(value) ? value : [];
  return {
    hour: toNumber(time[0]),
    minute: toNumber(time[1])
  };
}
function epochMsToDate(epochMs) {
  const date = new Date(epochMs);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}
var DS1_MARKERS = ["AF_initDataCallback({key: 'ds:1'", 'AF_initDataCallback({key:"ds:1"'];
var SCRIPT_TAG = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
var CAPTCHA_MARKERS = [
  "Our systems have detected unusual traffic",
  "recaptcha",
  "g-recaptcha",
  "/sorry/index"
];
function looksLikeCaptchaPage(html) {
  return CAPTCHA_MARKERS.some((marker) => html.includes(marker));
}
function extractDs1Script(html) {
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
function evaluateDs1Script(script) {
  let chunk;
  try {
    (0, import_node_vm.runInNewContext)(script, {
      AF_initDataCallback: (value) => {
        chunk = value;
      }
    }, {
      timeout: 100
    });
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to evaluate the ds:1 script: ${error.message ?? String(error)}`,
      { cause: error }
    );
  }
  if (!chunk || !isArray(chunk.data)) {
    throw new ParseFlightsError("The ds:1 script did not expose an array payload.");
  }
  return chunk.data;
}
function parseSegment(rawSegment) {
  const segment = isArray(rawSegment) ? rawSegment : [];
  const carrierInfo = isArray(segment[22]) ? segment[22] : [];
  const operatingCarrier = toString(carrierInfo[0]);
  const flightNumberDigits = toString(carrierInfo[1]);
  const flightNumber = operatingCarrier !== "" && flightNumberDigits !== "" ? `${operatingCarrier}${flightNumberDigits}` : "";
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
function parseLayover(rawLayover) {
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
function parseCarrierLink(rawEntry, type) {
  const entry = isArray(rawEntry) ? rawEntry : [];
  const code = toString(entry[0]);
  if (code === "") {
    return null;
  }
  const link = {
    code,
    name: toString(entry[1]),
    url: toString(entry[2])
  };
  if (type) {
    link.type = type;
  }
  return link;
}
function parseFarePolicy(extras) {
  const baggageHint = isArray(extras[9]) ? extras[9] : null;
  return {
    refundabilityCode: toNullableNumber(extras[15]),
    checkedBaggageIncluded: baggageHint === null ? null : baggageHint.some((value) => toNumber(value) > 0)
  };
}
function parseLocationRow(rawRow) {
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
  const kind = rowCode.startsWith("/") ? "city" : rowType === 0 ? "airport" : "place";
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
function parseFlexibleDateInsight(payload) {
  const insightRoot = isArray(payload[5]) ? payload[5] : [];
  const rawPoints = isArray(insightRoot[10]) && isArray(insightRoot[10][0]) ? insightRoot[10][0] : [];
  const destinationLabel = toString(insightRoot[12]);
  const pricePoints = rawPoints.filter(isArray).map((point) => {
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
  }).filter((point) => point !== null);
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
function parseMetadata(payload) {
  const metadataRoot = isArray(payload[7]) ? payload[7] : [];
  const carrierRoot = isArray(metadataRoot[1]) ? metadataRoot[1] : [];
  const allianceRows = isArray(carrierRoot[0]) ? carrierRoot[0] : [];
  const airlineRows = isArray(carrierRoot[1]) ? carrierRoot[1] : [];
  const baggageRows = isArray(payload[11]) ? payload[11] : [];
  const locationRows = isArray(payload[17]) ? payload[17] : [];
  return {
    alliances: allianceRows.filter(isArray).map((row) => ({
      code: toString(row[0]),
      name: toString(row[1])
    })).filter((row) => row.code !== "" && row.name !== ""),
    airlines: airlineRows.filter(isArray).map((row) => ({
      code: toString(row[0]),
      name: toString(row[1])
    })).filter((row) => row.code !== "" && row.name !== ""),
    baggageLinks: baggageRows.map((row) => parseCarrierLink(row, "baggage")).filter((row) => row !== null),
    locations: locationRows.map(parseLocationRow).filter((row) => row !== null),
    flexibleDateInsight: parseFlexibleDateInsight(payload)
  };
}
function buildBaggageLinkMap(links) {
  const map = /* @__PURE__ */ new Map();
  for (const link of links) {
    const current = map.get(link.code) ?? [];
    current.push(link);
    map.set(link.code, current);
  }
  return map;
}
function parseFlightResult(rawItem, baggageLinksByCode) {
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
  const carrierLinks = (isArray(flight[24]) ? flight[24] : []).map((entry) => parseCarrierLink(entry, "support")).filter((entry) => entry !== null);
  if (price === null || segments.length === 0) {
    return null;
  }
  const airlineCodes = /* @__PURE__ */ new Set();
  for (const segment of segments) {
    if (segment.operatingCarrier !== "") {
      airlineCodes.add(segment.operatingCarrier);
    }
  }
  const baggageLinks = Array.from(airlineCodes).flatMap((code) => baggageLinksByCode.get(code) ?? []);
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
function collectFlightSections(payload, includeSecondarySection) {
  const sections = [payload[3], ...includeSecondarySection ? [payload[2]] : []].filter(isArray).flatMap((section) => isArray(section[0]) ? section[0] : []);
  return sections;
}
function dedupeFlights(flights) {
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const flight of flights) {
    const key = flight.bookingToken !== "" ? `token:${flight.bookingToken}` : `segments:${flight.segments.map((segment) => `${segment.flightNumber}:${segment.departure.date.year}-${segment.departure.date.month}-${segment.departure.date.day}:${segment.departure.time.hour}:${segment.departure.time.minute}`).join("|")}:${flight.price}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(flight);
  }
  return deduped;
}
function parseFlightsPayload(payload, options = {}) {
  if (!isArray(payload)) {
    throw new ParseFlightsError("Expected Google Flights payload to be an array.");
  }
  const metadata = parseMetadata(payload);
  const baggageLinksByCode = buildBaggageLinkMap(metadata.baggageLinks);
  const flights = dedupeFlights(
    collectFlightSections(payload, options.includeSecondarySection ?? false).map((rawItem) => parseFlightResult(rawItem, baggageLinksByCode)).filter((flight) => flight !== null)
  );
  return {
    flights,
    metadata
  };
}
function parseRpcResponse(text) {
  const stripped = text.replace(/^\)\]\}'?\s*/, "");
  if (stripped.trim() === "") {
    throw new ParseFlightsError("Google Flights returned an empty RPC response.");
  }
  let outer;
  try {
    outer = JSON.parse(stripped);
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to parse Google Flights RPC envelope: ${error.message ?? String(error)}`,
      { cause: error }
    );
  }
  const innerJson = isArray(outer) && isArray(outer[0]) ? outer[0][2] : void 0;
  if (typeof innerJson !== "string") {
    throw new ParseFlightsError("Google Flights RPC response did not contain flight data at [0][2].");
  }
  let payload;
  try {
    payload = JSON.parse(innerJson);
  } catch (error) {
    throw new ParseFlightsError(
      `Failed to parse Google Flights RPC payload: ${error.message ?? String(error)}`,
      { cause: error }
    );
  }
  if (!isArray(payload)) {
    throw new ParseFlightsError("Google Flights RPC payload was not an array.");
  }
  return parseFlightsPayload(payload, { includeSecondarySection: true });
}
function parseFlightsHtml(html) {
  if (looksLikeCaptchaPage(html)) {
    throw new CaptchaError("Google returned an anti-bot / CAPTCHA page instead of flight results.");
  }
  const script = extractDs1Script(html);
  const payload = evaluateDs1Script(script);
  return parseFlightsPayload(payload);
}

// src/cache.ts
var SessionCache = class {
  maxEntries;
  ttlMs;
  entries = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 100);
    this.ttlMs = Math.max(0, options.ttlMs ?? 5 * 6e4);
  }
  get(key) {
    const existing = this.entries.get(key);
    if (!existing) {
      return void 0;
    }
    if (existing.expiresAt < Date.now()) {
      this.entries.delete(key);
      return void 0;
    }
    this.entries.delete(key);
    this.entries.set(key, existing);
    return existing.value;
  }
  set(key, value) {
    this.evictExpired();
    const wrapped = value.catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.delete(key);
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value: wrapped
    });
    this.evictOverflow();
    return wrapped;
  }
  clear() {
    this.entries.clear();
  }
  size() {
    this.evictExpired();
    return this.entries.size;
  }
  evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }
  evictOverflow() {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === void 0) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }
};
var defaultSessionCache = new SessionCache();

// src/filters.ts
function toMinutes(hours, minutes) {
  return hours * 60 + minutes;
}
function parseTime(text) {
  if (!text) {
    return null;
  }
  const [hourText, minuteText] = text.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}
function isWithinWindow(value, earliest, latest) {
  if (earliest !== null && value < earliest) {
    return false;
  }
  if (latest !== null && value > latest) {
    return false;
  }
  return true;
}
function matchesFilters(flight, filters) {
  if (!filters) {
    return true;
  }
  const firstSegment = flight.segments[0];
  const lastSegment = flight.segments[flight.segments.length - 1];
  if (!firstSegment || !lastSegment) {
    return false;
  }
  const departureTime = toMinutes(firstSegment.departure.time.hour, firstSegment.departure.time.minute);
  const departureEarliest = parseTime(filters.departureTime?.earliest);
  const departureLatest = parseTime(filters.departureTime?.latest);
  if (!isWithinWindow(departureTime, departureEarliest, departureLatest)) {
    return false;
  }
  const arrivalTime = toMinutes(lastSegment.arrival.time.hour, lastSegment.arrival.time.minute);
  const arrivalEarliest = parseTime(filters.arrivalTime?.earliest);
  const arrivalLatest = parseTime(filters.arrivalTime?.latest);
  if (!isWithinWindow(arrivalTime, arrivalEarliest, arrivalLatest)) {
    return false;
  }
  if (filters.layover) {
    for (const layover of flight.layovers) {
      if (filters.layover.minMinutes !== void 0 && layover.durationMinutes < filters.layover.minMinutes) {
        return false;
      }
      if (filters.layover.maxMinutes !== void 0 && layover.durationMinutes > filters.layover.maxMinutes) {
        return false;
      }
    }
  }
  if (filters.connectionAirports?.allow && filters.connectionAirports.allow.length > 0) {
    const allowed = new Set(filters.connectionAirports.allow);
    if (flight.layovers.some((layover) => !allowed.has(layover.airportCode))) {
      return false;
    }
  }
  if (filters.connectionAirports?.block && filters.connectionAirports.block.length > 0) {
    const blocked = new Set(filters.connectionAirports.block);
    if (flight.layovers.some((layover) => blocked.has(layover.airportCode))) {
      return false;
    }
  }
  return true;
}
function applyPostSearchFilters(result, filters) {
  if (!filters) {
    return result;
  }
  return {
    flights: result.flights.filter((flight) => matchesFilters(flight, filters)),
    metadata: result.metadata
  };
}

// src/rpc.ts
var GOOGLE_FLIGHTS_RPC_URL = "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";
function buildPassengerVector(passengers) {
  return [
    passengers?.adults ?? 1,
    passengers?.children ?? 0,
    passengers?.infantsInSeat ?? 0,
    passengers?.infantsOnLap ?? 0
  ];
}
function buildRpcSegment(segment, inheritedMaxStops) {
  const maxStops = segment.maxStops ?? inheritedMaxStops;
  return [
    [[[segment.fromAirport, 0]]],
    [[[segment.toAirport, 0]]],
    null,
    maxStops === void 0 ? 0 : maxStops + 1,
    segment.airlines ?? null,
    null,
    segment.date instanceof Date ? segment.date.toISOString().slice(0, 10) : segment.date,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    3
  ];
}
function buildRpcUrl(query) {
  const params = new URLSearchParams();
  if (query.language !== "") {
    params.set("hl", query.language);
  }
  if (query.currency !== "") {
    params.set("curr", query.currency);
  }
  if (query.region !== "") {
    params.set("gl", query.region);
  }
  const suffix = params.toString();
  return suffix === "" ? GOOGLE_FLIGHTS_RPC_URL : `${GOOGLE_FLIGHTS_RPC_URL}?${suffix}`;
}
function buildRpcRequestBody(input) {
  const filters = [
    [],
    [
      null,
      null,
      input.trip === "round-trip" ? 1 : input.trip === "multi-city" ? 3 : 2,
      null,
      [],
      input.seat === "premium-economy" ? 2 : input.seat === "business" ? 3 : input.seat === "first" ? 4 : 1,
      buildPassengerVector(input.passengers),
      null,
      null,
      null,
      null,
      null,
      null,
      input.flights.map((segment) => buildRpcSegment(segment, input.maxStops)),
      null,
      null,
      null,
      1,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    1,
    0,
    0,
    2
  ];
  const wrapped = JSON.stringify([null, JSON.stringify(filters)]);
  return `f.req=${encodeURIComponent(wrapped)}`;
}

// src/fetch.ts
var DEFAULT_TIMEOUT_MS = 3e4;
var GOOGLE_FLIGHTS_SEARCH_URL2 = "https://www.google.com/travel/flights/search";
var DEFAULT_HEADERS = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};
function errorName(value) {
  if (typeof value !== "object" || value === null || !("name" in value)) {
    return void 0;
  }
  const name = value.name;
  return typeof name === "string" ? name : void 0;
}
function isTimeoutLike(value) {
  return errorName(value) === "TimeoutError";
}
function abortToFetchError(signal, cause, url) {
  if (isTimeoutLike(cause) || isTimeoutLike(signal?.reason)) {
    return new TimeoutError("Google Flights request timed out.", {
      cause,
      ...url === void 0 ? {} : { url }
    });
  }
  return new FetchFlightsError("Google Flights request was aborted.", {
    cause,
    ...url === void 0 ? {} : { url }
  });
}
function resolveFetch(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof globalThis.fetch !== "function") {
    throw new FetchFlightsError("No fetch implementation is available. Provide one through options.fetch.");
  }
  return globalThis.fetch.bind(globalThis);
}
function buildHeaders(options) {
  if (options.replaceHeaders) {
    return options.headers ?? {};
  }
  return { ...DEFAULT_HEADERS, ...options.headers };
}
function combineSignals(user, timeoutMs) {
  if (timeoutMs <= 0) {
    return user;
  }
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!user) {
    return timeoutSignal;
  }
  const controller = new AbortController();
  const onAbort = (reason) => controller.abort(reason);
  if (user.aborted) controller.abort(user.reason);
  else user.addEventListener("abort", () => onAbort(user.reason), { once: true });
  if (timeoutSignal.aborted) controller.abort(timeoutSignal.reason);
  else timeoutSignal.addEventListener("abort", () => onAbort(timeoutSignal.reason), { once: true });
  return controller.signal;
}
function defaultShouldRetry(error) {
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error.status === void 0) {
    return true;
  }
  return error.status === 429 || error.status >= 500 && error.status < 600;
}
async function sleep(ms, signal) {
  if (ms <= 0) return;
  return new Promise((resolve, reject) => {
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
async function resolveProxy(proxy) {
  if (!proxy) {
    return void 0;
  }
  if (typeof proxy === "string") {
    const trimmed2 = proxy.trim();
    return trimmed2 === "" ? void 0 : trimmed2;
  }
  const resolved = await proxy();
  const trimmed = resolved.trim();
  return trimmed === "" ? void 0 : trimmed;
}
async function maybeCreateDispatcher(proxy) {
  if (!proxy) {
    return void 0;
  }
  try {
    const { ProxyAgent } = await import("undici");
    return new ProxyAgent(proxy);
  } catch {
    return void 0;
  }
}
function inferStatusText(status) {
  return status === 429 ? "Too Many Requests" : "";
}
function toStructuredInput(input) {
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
function toEncodedQuery(input) {
  if (typeof input === "string") {
    return null;
  }
  return "tfs" in input ? input : createQuery(input);
}
function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObjectKeys(value[key]);
    }
    return sorted;
  }
  return value;
}
function buildCacheKey(input, transport) {
  if (typeof input === "string") {
    return `string:${transport}:${input}`;
  }
  const encoded = "tfs" in input ? input : createQuery(input);
  const structured = "tfs" in input ? {
    ...decodeQuery(input.tfs),
    language: input.language,
    currency: input.currency,
    region: input.region
  } : input;
  return JSON.stringify(sortObjectKeys({
    transport,
    encoded,
    structured
  }));
}
function resolveCache(cache) {
  if (cache === false) {
    return null;
  }
  if (cache instanceof SessionCache) {
    return cache;
  }
  if (cache === true || cache === void 0) {
    return defaultSessionCache;
  }
  return new SessionCache(cache);
}
async function runWithRetry(fn, retry, signal) {
  const attempts = Math.max(0, retry?.attempts ?? 0);
  const baseDelayMs = Math.max(0, retry?.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, retry?.maxDelayMs ?? 1e4);
  const shouldRetry = retry?.shouldRetry ?? defaultShouldRetry;
  let lastError;
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
  throw lastError;
}
async function fetchText(url, init, options, signal, attempt, transport) {
  const fetchImpl = resolveFetch(options.fetch);
  const proxy = await resolveProxy(options.proxy);
  const dispatcher = await maybeCreateDispatcher(proxy);
  const finalInit = { ...init };
  if (signal) {
    finalInit.signal = signal;
  }
  if (dispatcher) {
    finalInit.dispatcher = dispatcher;
  }
  options.onRequest?.({ attempt, transport, url, ...proxy ? { proxy } : {} });
  let response;
  try {
    if (signal?.aborted) {
      throw abortToFetchError(signal, signal.reason, url);
    }
    const responsePromise = fetchImpl(url, finalInit);
    if (signal) {
      response = await Promise.race([
        responsePromise,
        new Promise((_resolve, reject) => {
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
      `Failed to reach Google Flights: ${error.message ?? String(error)}`,
      { cause: error, url }
    );
  }
  const text = await response.text();
  options.onResponse?.({
    attempt,
    transport,
    url,
    ...proxy ? { proxy } : {},
    status: response.status,
    ok: response.ok,
    bytes: text.length
  });
  return { response, text, ...proxy ? { proxy } : {} };
}
function throwForHttpResponse(response, text, url) {
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
async function attemptFetchHtml(url, options, signal, attempt) {
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
async function attemptFetchRpc(query, structured, options, signal, attempt) {
  const url = buildRpcUrl(query);
  const { response, text } = await fetchText(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "origin": "https://www.google.com",
      "referer": GOOGLE_FLIGHTS_SEARCH_URL2,
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
function parseWithTelemetry(transport, options, parse) {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ParseFlightsError || error instanceof CaptchaError) {
      options.onParseError?.({ transport, error });
    }
    throw error;
  }
}
async function fetchViaHtml(input, options) {
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
async function fetchViaRpc(input, options) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  const encoded = toEncodedQuery(input);
  const structured = toStructuredInput(input);
  const text = await runWithRetry(
    (attempt) => attemptFetchRpc(encoded, structured, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
  const result = parseWithTelemetry("rpc", options, () => parseRpcResponse(text));
  return applyPostSearchFilters(result, structured.filters);
}
async function fetchFlightsHtml(input, options = {}) {
  const url = buildSearchUrl(input);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  return runWithRetry(
    (attempt) => attemptFetchHtml(url, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
}
async function fetchFlightsRpcText(input, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalSignal = combineSignals(options.signal, timeoutMs);
  const encoded = toEncodedQuery(input);
  const structured = toStructuredInput(input);
  return runWithRetry(
    (attempt) => attemptFetchRpc(encoded, structured, options, totalSignal, attempt),
    options.retry,
    totalSignal
  );
}
function clearSessionCache() {
  defaultSessionCache.clear();
}
async function fetchFlights(input, options = {}) {
  const transport = options.transport ?? (toStructuredInput(input) ? "auto" : "html");
  const structured = toStructuredInput(input);
  const cache = resolveCache(options.cache);
  const cacheKey = buildCacheKey(input, transport);
  const compute = async () => {
    if (transport === "rpc") {
      if (!structured) {
        throw new FetchFlightsError("RPC transport requires a structured or encoded query.");
      }
      return fetchViaRpc(typeof input === "string" ? structured : input, options);
    }
    if (transport === "auto" && structured) {
      try {
        return await fetchViaRpc(typeof input === "string" ? structured : input, options);
      } catch (error) {
        if (error instanceof ParseFlightsError) {
          options.onParseError?.({ transport: "rpc", error });
          return fetchViaHtml(input, options);
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

// src/sweep.ts
var SweepRun = class {
  queue = [];
  waiters = [];
  closed = false;
  donePromise = Promise.resolve([]);
  setDonePromise(donePromise) {
    this.donePromise = donePromise;
  }
  push(entry) {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: entry, done: false });
      return;
    }
    this.queue.push(entry);
  }
  close() {
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: void 0, done: true });
    }
  }
  then(onfulfilled, onrejected) {
    return this.donePromise.then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.donePromise.catch(onrejected);
  }
  finally(onfinally) {
    return this.donePromise.finally(onfinally);
  }
  [Symbol.asyncIterator]() {
    return {
      next: () => {
        const queued = this.queue.shift();
        if (queued) {
          return Promise.resolve({ value: queued, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: void 0, done: true });
        }
        return new Promise((resolve) => {
          this.waiters.push(resolve);
        });
      }
    };
  }
};
function sweepFlights(queries, options = {}) {
  const run = new SweepRun();
  run.setDonePromise((async () => {
    if (queries.length === 0) {
      run.close();
      return [];
    }
    const concurrency = Math.max(1, options.concurrency ?? 3);
    const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
    const results = new Array(queries.length);
    let cursor = 0;
    let nextSlot = Date.now();
    const reserveSlot = async () => {
      if (minDelayMs <= 0) return Date.now();
      const now = Date.now();
      const myStart = Math.max(now, nextSlot);
      nextSlot = myStart + minDelayMs;
      const wait = myStart - now;
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      return myStart;
    };
    const worker = async () => {
      while (true) {
        if (options.signal?.aborted) return;
        const index = cursor++;
        if (index >= queries.length) return;
        const startedAt = await reserveSlot();
        if (options.signal?.aborted) return;
        const input = queries[index];
        const entry = { input, startedAt, finishedAt: 0 };
        try {
          entry.result = await fetchFlights(input, options);
        } catch (error) {
          entry.error = error;
        }
        entry.finishedAt = Date.now();
        results[index] = entry;
        run.push(entry);
        options.onResult?.(entry, index);
      }
    };
    try {
      const workers = Array.from(
        { length: Math.min(concurrency, queries.length) },
        () => worker()
      );
      await Promise.all(workers);
      return results;
    } finally {
      run.close();
    }
  })());
  return run;
}

// src/nearby.ts
function createLocationIndex(locations) {
  const byCity = /* @__PURE__ */ new Map();
  for (const location of locations) {
    const key = location.cityCode || location.code;
    const existing = byCity.get(key) ?? {
      code: key,
      cityCode: location.cityCode || key,
      cityName: location.cityName || location.name,
      airports: []
    };
    if (location.kind === "airport" && !existing.airports.includes(location.code)) {
      existing.airports.push(location.code);
    }
    byCity.set(key, existing);
    byCity.set(location.code, existing);
  }
  return byCity;
}
function expandLocationCode(code, locations) {
  const index = locations instanceof Map ? locations : createLocationIndex(locations);
  const normalizedCode = code.trim().toUpperCase();
  const entry = index.get(normalizedCode);
  if (!entry || entry.airports.length === 0) {
    return [normalizedCode];
  }
  return [...entry.airports];
}

// src/schemas.ts
var import_zod = require("zod");
var simpleDateSchema = import_zod.z.object({
  year: import_zod.z.number().int(),
  month: import_zod.z.number().int(),
  day: import_zod.z.number().int()
});
var simpleTimeSchema = import_zod.z.object({
  hour: import_zod.z.number().int(),
  minute: import_zod.z.number().int()
});
var flightTimestampSchema = import_zod.z.object({
  date: simpleDateSchema,
  time: simpleTimeSchema
});
var airportSchema = import_zod.z.object({
  code: import_zod.z.string(),
  name: import_zod.z.string()
});
var flightSegmentSchema = import_zod.z.object({
  fromAirport: airportSchema,
  toAirport: airportSchema,
  departure: flightTimestampSchema,
  arrival: flightTimestampSchema,
  durationMinutes: import_zod.z.number().int(),
  planeType: import_zod.z.string(),
  operatingCarrier: import_zod.z.string(),
  flightNumber: import_zod.z.string(),
  legroom: import_zod.z.string()
});
var layoverSchema = import_zod.z.object({
  durationMinutes: import_zod.z.number().int(),
  airportCode: import_zod.z.string(),
  airportName: import_zod.z.string(),
  cityName: import_zod.z.string(),
  changeOfAirport: import_zod.z.boolean()
});
var carrierLinkSchema = import_zod.z.object({
  code: import_zod.z.string(),
  name: import_zod.z.string(),
  url: import_zod.z.string(),
  type: import_zod.z.enum(["support", "baggage"]).optional()
});
var carbonEmissionSchema = import_zod.z.object({
  emission: import_zod.z.number().int(),
  typicalOnRoute: import_zod.z.number().int()
});
var farePolicySchema = import_zod.z.object({
  refundabilityCode: import_zod.z.number().int().nullable(),
  checkedBaggageIncluded: import_zod.z.boolean().nullable()
});
var flexibleDatePricePointSchema = import_zod.z.object({
  epochMs: import_zod.z.number().int(),
  date: simpleDateSchema,
  price: import_zod.z.number().int()
});
var flexibleDateInsightSchema = import_zod.z.object({
  destinationLabel: import_zod.z.string(),
  cheapestPrice: import_zod.z.number().int().nullable(),
  highestPrice: import_zod.z.number().int().nullable(),
  pricePoints: import_zod.z.array(flexibleDatePricePointSchema)
});
var locationMetadataSchema = import_zod.z.object({
  code: import_zod.z.string(),
  kind: import_zod.z.enum(["airport", "city", "place"]),
  name: import_zod.z.string(),
  cityName: import_zod.z.string(),
  cityCode: import_zod.z.string(),
  countryCode: import_zod.z.string(),
  countryName: import_zod.z.string()
});
var airlineMetadataSchema = import_zod.z.object({
  code: import_zod.z.string(),
  name: import_zod.z.string()
});
var allianceMetadataSchema = import_zod.z.object({
  code: import_zod.z.string(),
  name: import_zod.z.string()
});
var flightResultSchema = import_zod.z.object({
  type: import_zod.z.string(),
  price: import_zod.z.number().int(),
  airlines: import_zod.z.array(import_zod.z.string()),
  segments: import_zod.z.array(flightSegmentSchema),
  totalDurationMinutes: import_zod.z.number().int(),
  stopCount: import_zod.z.number().int(),
  layovers: import_zod.z.array(layoverSchema),
  carbon: carbonEmissionSchema,
  farePolicy: farePolicySchema,
  bookingToken: import_zod.z.string(),
  carrierLinks: import_zod.z.array(carrierLinkSchema),
  baggageLinks: import_zod.z.array(carrierLinkSchema)
});
var flightsSearchResultSchema = import_zod.z.object({
  flights: import_zod.z.array(flightResultSchema),
  metadata: import_zod.z.object({
    airlines: import_zod.z.array(airlineMetadataSchema),
    alliances: import_zod.z.array(allianceMetadataSchema),
    baggageLinks: import_zod.z.array(carrierLinkSchema),
    locations: import_zod.z.array(locationMetadataSchema),
    flexibleDateInsight: flexibleDateInsightSchema.nullable()
  })
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CaptchaError,
  FetchFlightsError,
  HttpError,
  ParseFlightsError,
  QueryValidationError,
  RateLimitError,
  SessionCache,
  SweepRun,
  TimeoutError,
  airlineMetadataSchema,
  airportSchema,
  allianceMetadataSchema,
  buildSearchUrl,
  carbonEmissionSchema,
  carrierLinkSchema,
  clearSessionCache,
  createLocationIndex,
  createQuery,
  decodeQuery,
  defaultSessionCache,
  expandLocationCode,
  farePolicySchema,
  fetchFlights,
  fetchFlightsHtml,
  fetchFlightsRpcText,
  flexibleDateInsightSchema,
  flexibleDatePricePointSchema,
  flightResultSchema,
  flightSegmentSchema,
  flightTimestampSchema,
  flightsSearchResultSchema,
  layoverSchema,
  locationMetadataSchema,
  parseFlightsHtml,
  parseFlightsPayload,
  parseRpcResponse,
  simpleDateSchema,
  simpleTimeSchema,
  sweepFlights
});
//# sourceMappingURL=index.cjs.map