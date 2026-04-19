import { QueryValidationError } from "./errors.js";
const GOOGLE_FLIGHTS_SEARCH_URL = "https://www.google.com/travel/flights/search";
const TEXT_ENCODER = new TextEncoder();
const IATA_CODE = /^[A-Z]{3}$/;
const AIRLINE_FILTER = /^[A-Z0-9_]{2,32}$/;
const MAX_SAFE_VARINT = 2 ** 31 - 1;
const SEAT_ENUM = {
    economy: 1,
    "premium-economy": 2,
    business: 3,
    first: 4
};
const SEAT_REVERSE = {
    1: "economy",
    2: "premium-economy",
    3: "business",
    4: "first"
};
const TRIP_ENUM = {
    "round-trip": 1,
    "one-way": 2,
    "multi-city": 3
};
const TRIP_REVERSE = {
    1: "round-trip",
    2: "one-way",
    3: "multi-city"
};
const PASSENGER_ENUM = {
    adult: 1,
    child: 2,
    infantInSeat: 3,
    infantOnLap: 4
};
const TEXT_DECODER = new TextDecoder();
var WireType;
(function (WireType) {
    WireType[WireType["Varint"] = 0] = "Varint";
    WireType[WireType["LengthDelimited"] = 2] = "LengthDelimited";
})(WireType || (WireType = {}));
class ProtoWriter {
    chunks = [];
    writeTag(fieldNumber, wireType) {
        this.writeVarint((fieldNumber << 3) | wireType);
    }
    writeVarint(value) {
        if (!Number.isInteger(value) || value < 0 || value > MAX_SAFE_VARINT) {
            throw new QueryValidationError(`Expected a non-negative integer varint within 31-bit range, received ${value}.`);
        }
        let remaining = value;
        while (remaining > 0x7f) {
            this.chunks.push((remaining & 0x7f) | 0x80);
            remaining >>>= 7;
        }
        this.chunks.push(remaining);
    }
    writeString(fieldNumber, value) {
        const bytes = TEXT_ENCODER.encode(value);
        this.writeTag(fieldNumber, WireType.LengthDelimited);
        this.writeVarint(bytes.length);
        this.writeRawBytes(bytes);
    }
    writeMessage(fieldNumber, bytes) {
        this.writeTag(fieldNumber, WireType.LengthDelimited);
        this.writeVarint(bytes.length);
        this.writeRawBytes(bytes);
    }
    writeEnum(fieldNumber, value) {
        this.writeTag(fieldNumber, WireType.Varint);
        this.writeVarint(value);
    }
    writeInt32(fieldNumber, value) {
        this.writeTag(fieldNumber, WireType.Varint);
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
}
function normalizeAirportCode(value, fieldName) {
    const code = value.trim().toUpperCase();
    if (!IATA_CODE.test(code)) {
        throw new QueryValidationError(`${fieldName} must be a 3-letter IATA airport code. Received "${value}".`);
    }
    return code;
}
function normalizeAirlineCode(value) {
    const code = value.trim().toUpperCase();
    if (!AIRLINE_FILTER.test(code)) {
        throw new QueryValidationError(`Airline filter must be an IATA airline code (e.g. "JL") or an alliance identifier (e.g. "STAR_ALLIANCE"). Received "${value}".`);
    }
    return code;
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
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isInteger(value) || value < 0) {
        throw new QueryValidationError(`${fieldName} must be a non-negative integer. Received ${value}.`);
    }
    return value;
}
function assertTripMatchesSegments(trip, segmentCount) {
    if (trip === "one-way" && segmentCount !== 1) {
        throw new QueryValidationError(`trip "one-way" requires exactly one flight segment (received ${segmentCount}).`);
    }
    if (trip === "round-trip" && segmentCount !== 2) {
        throw new QueryValidationError(`trip "round-trip" requires exactly two flight segments (received ${segmentCount}).`);
    }
    if (trip === "multi-city" && segmentCount < 2) {
        throw new QueryValidationError(`trip "multi-city" requires at least two flight segments (received ${segmentCount}).`);
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
    if (maxStops !== undefined) {
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
export function createQuery(input) {
    const encodedInfo = encodeInfo(input);
    const tfs = Buffer.from(encodedInfo).toString("base64");
    const language = input.language ?? "";
    const currency = input.currency ?? "";
    const params = new URLSearchParams();
    params.set("tfs", tfs);
    if (language !== "") {
        params.set("hl", language);
    }
    if (currency !== "") {
        params.set("curr", currency);
    }
    return {
        tfs,
        language,
        currency,
        params,
        url: `${GOOGLE_FLIGHTS_SEARCH_URL}?${params.toString()}`
    };
}
export function buildSearchUrl(input) {
    if (typeof input === "string") {
        const params = new URLSearchParams({ q: input });
        return `${GOOGLE_FLIGHTS_SEARCH_URL}?${params.toString()}`;
    }
    if ("tfs" in input) {
        return input.url;
    }
    return createQuery(input).url;
}
class ProtoReader {
    bytes;
    offset = 0;
    constructor(bytes) {
        this.bytes = bytes;
    }
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
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0)
                return result >>> 0;
            shift += 7;
            if (shift > 28) {
                throw new QueryValidationError("Varint exceeds 32-bit range in tfs payload.");
            }
        }
    }
    readTag() {
        const tag = this.readVarint();
        return { fieldNumber: tag >>> 3, wireType: tag & 0x7 };
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
        if (wireType === 0)
            this.readVarint();
        else if (wireType === 2)
            this.readBytes();
        else if (wireType === 1)
            this.offset += 8;
        else if (wireType === 5)
            this.offset += 4;
        else
            throw new QueryValidationError(`Unsupported wire type ${wireType} in tfs payload.`);
    }
}
function decodeAirport(bytes) {
    const reader = new ProtoReader(bytes);
    let code = "";
    while (reader.hasMore()) {
        const { fieldNumber, wireType } = reader.readTag();
        if (fieldNumber === 2 && wireType === 2)
            code = reader.readString();
        else
            reader.skip(wireType);
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
        if (fieldNumber === 2 && wireType === 2)
            date = reader.readString();
        else if (fieldNumber === 5 && wireType === 0)
            maxStops = reader.readVarint();
        else if (fieldNumber === 6 && wireType === 2)
            airlines.push(reader.readString());
        else if (fieldNumber === 13 && wireType === 2)
            fromAirport = decodeAirport(reader.readBytes());
        else if (fieldNumber === 14 && wireType === 2)
            toAirport = decodeAirport(reader.readBytes());
        else
            reader.skip(wireType);
    }
    const flight = { date, fromAirport, toAirport };
    if (maxStops !== undefined)
        flight.maxStops = maxStops;
    if (airlines.length > 0)
        flight.airlines = airlines;
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
        if (value === PASSENGER_ENUM.adult)
            adults++;
        else if (value === PASSENGER_ENUM.child)
            children++;
        else if (value === PASSENGER_ENUM.infantInSeat)
            infantsInSeat++;
        else if (value === PASSENGER_ENUM.infantOnLap)
            infantsOnLap++;
    }
    const counts = {};
    if (adults > 0)
        counts.adults = adults;
    if (children > 0)
        counts.children = children;
    if (infantsInSeat > 0)
        counts.infantsInSeat = infantsInSeat;
    if (infantsOnLap > 0)
        counts.infantsOnLap = infantsOnLap;
    return counts;
}
/**
 * Inverse of `createQuery`. Decodes a base64-encoded `tfs` payload back into a
 * structured query input. Useful for debugging generated URLs, round-tripping,
 * and as a structural check against encoder drift.
 *
 * `language` and `currency` are not part of the `tfs` payload, so they are not
 * returned; callers that need them should read the surrounding `hl` / `curr`
 * query-string parameters.
 */
export function decodeQuery(tfs) {
    if (typeof tfs !== "string" || tfs.length === 0) {
        throw new QueryValidationError("decodeQuery requires a non-empty base64 tfs string.");
    }
    let bytes;
    try {
        bytes = Uint8Array.from(Buffer.from(tfs, "base64"));
    }
    catch (error) {
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
        if (fieldNumber === 3 && wireType === 2)
            flights.push(decodeFlight(reader.readBytes()));
        else if (fieldNumber === 8 && wireType === 2)
            passengers = decodePassengers(reader.readBytes());
        else if (fieldNumber === 9 && wireType === 0)
            seat = SEAT_REVERSE[reader.readVarint()];
        else if (fieldNumber === 19 && wireType === 0)
            trip = TRIP_REVERSE[reader.readVarint()];
        else
            reader.skip(wireType);
    }
    if (flights.length === 0) {
        throw new QueryValidationError("Decoded tfs payload contained no flight segments.");
    }
    const result = { flights };
    if (passengers !== undefined)
        result.passengers = passengers;
    if (seat !== undefined)
        result.seat = seat;
    if (trip !== undefined)
        result.trip = trip;
    return result;
}
//# sourceMappingURL=query.js.map