import { runInNewContext } from "node:vm";
import { ParseFlightsError } from "./errors.js";
function isArray(value) {
    return Array.isArray(value);
}
function toNumber(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
function extractDs1Script(html) {
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of scripts) {
        const script = match[1] ?? "";
        if (script.includes("AF_initDataCallback({key: 'ds:1'") || script.includes('AF_initDataCallback({key:"ds:1"')) {
            return script;
        }
    }
    throw new ParseFlightsError("Could not find the ds:1 bootstrap payload in the Google Flights HTML.");
}
function evaluateDs1Script(script) {
    let chunk;
    runInNewContext(script, {
        AF_initDataCallback: (value) => {
            chunk = value;
        }
    }, {
        timeout: 100
    });
    if (!chunk || !isArray(chunk.data)) {
        throw new ParseFlightsError("The ds:1 script did not expose an array payload.");
    }
    return chunk.data;
}
function parseSegment(rawSegment) {
    const segment = isArray(rawSegment) ? rawSegment : [];
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
        planeType: toString(segment[17])
    };
}
function parseLayover(rawLayover) {
    const layover = isArray(rawLayover) ? rawLayover : [];
    return {
        durationMinutes: toNumber(layover[0]),
        airportCode: toString(layover[1]),
        airportName: toString(layover[4]),
        cityName: toString(layover[5])
    };
}
function parseFlightResult(rawItem) {
    const item = isArray(rawItem) ? rawItem : [];
    const flight = isArray(item[0]) ? item[0] : null;
    if (!flight) {
        return null;
    }
    const price = readPrice(item[1]);
    const segments = isArray(flight[2]) ? flight[2].map(parseSegment) : [];
    const layovers = isArray(flight[13]) ? flight[13].map(parseLayover) : [];
    const extras = isArray(flight[22]) ? flight[22] : [];
    if (price === null || segments.length === 0) {
        return null;
    }
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
        }
    };
}
function parseMetadata(payload) {
    const metadataRoot = isArray(payload[7]) ? payload[7] : [];
    const carrierRoot = isArray(metadataRoot[1]) ? metadataRoot[1] : [];
    const allianceRows = isArray(carrierRoot[0]) ? carrierRoot[0] : [];
    const airlineRows = isArray(carrierRoot[1]) ? carrierRoot[1] : [];
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
            .filter((row) => row.code !== "" && row.name !== "")
    };
}
function parsePayload(payload) {
    const flightsRoot = isArray(payload[3]) ? payload[3] : [];
    const rawFlights = isArray(flightsRoot[0]) ? flightsRoot[0] : [];
    const flights = rawFlights
        .map(parseFlightResult)
        .filter((flight) => flight !== null);
    return {
        flights,
        metadata: parseMetadata(payload)
    };
}
export function parseFlightsHtml(html) {
    const script = extractDs1Script(html);
    const payload = evaluateDs1Script(script);
    return parsePayload(payload);
}
//# sourceMappingURL=parse.js.map