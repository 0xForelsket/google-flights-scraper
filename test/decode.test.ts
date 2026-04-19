import { describe, expect, it } from "vitest";

import { createQuery, decodeQuery } from "../src/query.js";
import { QueryValidationError } from "../src/errors.js";

describe("decodeQuery", () => {
  it("round-trips a one-way query", () => {
    const input = {
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
      trip: "one-way" as const,
      seat: "economy" as const,
      passengers: { adults: 1 }
    };
    const encoded = createQuery(input);
    const decoded = decodeQuery(encoded.tfs);
    expect(createQuery(decoded).tfs).toBe(encoded.tfs);
  });

  it("round-trips a round-trip query with mixed passengers", () => {
    const input = {
      flights: [
        { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" },
        { date: "2026-05-20", fromAirport: "NRT", toAirport: "KUL" }
      ],
      trip: "round-trip" as const,
      seat: "business" as const,
      passengers: { adults: 2, children: 1 }
    };
    const encoded = createQuery(input);
    const decoded = decodeQuery(encoded.tfs);
    expect(decoded.flights).toHaveLength(2);
    expect(decoded.seat).toBe("business");
    expect(decoded.trip).toBe("round-trip");
    expect(decoded.passengers).toEqual({ adults: 2, children: 1 });
    expect(createQuery(decoded).tfs).toBe(encoded.tfs);
  });

  it("round-trips multi-city with inherited maxStops and airline filter", () => {
    const input = {
      flights: [
        { date: "2026-06-01", fromAirport: "SFO", toAirport: "JFK" },
        { date: "2026-06-05", fromAirport: "JFK", toAirport: "LHR", airlines: ["STAR_ALLIANCE"] },
        { date: "2026-06-12", fromAirport: "LHR", toAirport: "SFO" }
      ],
      trip: "multi-city" as const,
      seat: "premium-economy" as const,
      passengers: { adults: 1, infantsOnLap: 1 },
      maxStops: 1
    };
    const encoded = createQuery(input);
    const decoded = decodeQuery(encoded.tfs);

    expect(decoded.flights[0]?.maxStops).toBe(1);
    expect(decoded.flights[1]?.airlines).toEqual(["STAR_ALLIANCE"]);
    expect(decoded.seat).toBe("premium-economy");
    expect(decoded.trip).toBe("multi-city");
    expect(decoded.passengers).toEqual({ adults: 1, infantsOnLap: 1 });

    // Round-trip the decoded structure. The top-level maxStops is flattened
    // onto each flight during encode, so re-encoding the decoded shape
    // produces the same tfs.
    expect(createQuery(decoded).tfs).toBe(encoded.tfs);
  });

  it("rejects empty or non-string tfs", () => {
    expect(() => decodeQuery("")).toThrow(QueryValidationError);
    // @ts-expect-error — runtime check
    expect(() => decodeQuery(undefined)).toThrow(QueryValidationError);
  });

  it("rejects garbage base64", () => {
    expect(() => decodeQuery("!!!not-base64!!!")).toThrow(QueryValidationError);
  });
});
