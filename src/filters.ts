import type { FlightResult, FlightsSearchResult } from "./parse.js";
import type { PostSearchFilters } from "./query.js";

function toMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

function parseTime(text: string | undefined): number | null {
  if (!text) {
    return null;
  }

  const [hourText, minuteText] = text.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function isWithinWindow(value: number, earliest: number | null, latest: number | null): boolean {
  if (earliest !== null && value < earliest) {
    return false;
  }
  if (latest !== null && value > latest) {
    return false;
  }
  return true;
}

function matchesFilters(flight: FlightResult, filters: PostSearchFilters | undefined): boolean {
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
      if (filters.layover.minMinutes !== undefined && layover.durationMinutes < filters.layover.minMinutes) {
        return false;
      }
      if (filters.layover.maxMinutes !== undefined && layover.durationMinutes > filters.layover.maxMinutes) {
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

export function applyPostSearchFilters(
  result: FlightsSearchResult,
  filters: PostSearchFilters | undefined
): FlightsSearchResult {
  if (!filters) {
    return result;
  }

  return {
    flights: result.flights.filter((flight) => matchesFilters(flight, filters)),
    metadata: result.metadata
  };
}
