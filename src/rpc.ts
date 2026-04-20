import type { EncodedQuery, PassengerCounts, StructuredQueryInput } from "./query.js";

const GOOGLE_FLIGHTS_RPC_URL = "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

function buildPassengerVector(passengers: PassengerCounts | undefined): [number, number, number, number] {
  return [
    passengers?.adults ?? 1,
    passengers?.children ?? 0,
    passengers?.infantsInSeat ?? 0,
    passengers?.infantsOnLap ?? 0
  ];
}

function buildRpcSegment(segment: StructuredQueryInput["flights"][number], inheritedMaxStops?: number): unknown[] {
  return [
    [[[segment.fromAirport, 0]]],
    [[[segment.toAirport, 0]]],
    null,
    segment.maxStops ?? inheritedMaxStops ?? 0,
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

export function buildRpcUrl(query: EncodedQuery): string {
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

export function buildRpcRequestBody(input: StructuredQueryInput): string {
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
