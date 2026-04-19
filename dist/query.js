import { QueryValidationError } from "./errors.js";
const GOOGLE_FLIGHTS_SEARCH_URL = "https://www.google.com/travel/flights/search";
const TEXT_ENCODER = new TextEncoder();
const SEAT_ENUM = {
    economy: 1,
    "premium-economy": 2,
    business: 3,
    first: 4
};
const TRIP_ENUM = {
    "round-trip": 1,
    "one-way": 2,
    "multi-city": 3
};
const PASSENGER_ENUM = {
    adult: 1,
    child: 2,
    infantInSeat: 3,
    infantOnLap: 4
};
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
        if (!Number.isInteger(value) || value < 0) {
            throw new QueryValidationError(`Expected a non-negative integer varint, received ${value}.`);
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
    if (code.length < 3) {
        throw new QueryValidationError(`${fieldName} must be a valid IATA-style airport code.`);
    }
    return code;
}
function normalizeDate(value) {
    if (value instanceof Date) {
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
function buildPassengers(counts) {
    const adults = counts?.adults ?? 1;
    const children = counts?.children ?? 0;
    const infantsInSeat = counts?.infantsInSeat ?? 0;
    const infantsOnLap = counts?.infantsOnLap ?? 0;
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
    const maxStops = flight.maxStops ?? inheritedMaxStops;
    writer.writeString(2, date);
    if (maxStops !== undefined) {
        writer.writeInt32(5, maxStops);
    }
    for (const airline of flight.airlines ?? []) {
        writer.writeString(6, airline.trim().toUpperCase());
    }
    writer.writeMessage(13, encodeAirport(fromAirport));
    writer.writeMessage(14, encodeAirport(toAirport));
    return writer.finish();
}
function encodeInfo(input) {
    const writer = new ProtoWriter();
    const flights = input.flights;
    if (flights.length < 1) {
        throw new QueryValidationError("At least one flight segment is required.");
    }
    const passengers = buildPassengers(input.passengers);
    const seat = SEAT_ENUM[input.seat ?? "economy"];
    const trip = TRIP_ENUM[input.trip ?? "one-way"];
    for (const flight of flights) {
        writer.writeMessage(3, encodeFlightData(flight, input.maxStops));
    }
    if (passengers.length > 0) {
        const passengerWriter = new ProtoWriter();
        for (const passenger of passengers) {
            passengerWriter.writeVarint(passenger);
        }
        writer.writeMessage(8, passengerWriter.finish());
    }
    writer.writeEnum(9, seat);
    writer.writeEnum(19, trip);
    return writer.finish();
}
export function createQuery(input) {
    const encodedInfo = encodeInfo(input);
    const tfs = Buffer.from(encodedInfo).toString("base64");
    const language = input.language ?? "";
    const currency = input.currency ?? "";
    const params = new URLSearchParams({
        tfs,
        hl: language,
        curr: currency
    });
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
//# sourceMappingURL=query.js.map