import { describe, expect, it } from "vitest";

import { buildRpcRequestBody } from "../src/rpc.js";

describe("buildRpcRequestBody", () => {
  it("encodes maxStops as Google's RPC stop-count convention", () => {
    const body = buildRpcRequestBody({
      flights: [
        { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT", maxStops: 0 },
        { date: "2026-05-20", fromAirport: "NRT", toAirport: "KUL" }
      ],
      maxStops: 1,
      trip: "round-trip"
    });

    const encoded = body.slice("f.req=".length);
    const [outerNull, filtersJson] = JSON.parse(decodeURIComponent(encoded));
    expect(outerNull).toBeNull();

    const filters = JSON.parse(filtersJson);
    const segments = filters[1][13];

    expect(segments[0][3]).toBe(1);
    expect(segments[1][3]).toBe(2);
  });
});
