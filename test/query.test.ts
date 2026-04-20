import { describe, expect, it } from "vitest";

import { buildSearchUrl, createQuery } from "../src/query.js";
import { QueryValidationError } from "../src/errors.js";

describe("createQuery", () => {
  it("matches the protobuf payload emitted by the Python implementation", () => {
    const query = createQuery({
      flights: [
        {
          date: "2026-05-10",
          fromAirport: "KUL",
          toAirport: "NRT"
        }
      ],
      trip: "one-way",
      seat: "economy",
      passengers: { adults: 1 },
      language: "en-US"
    });

    expect(query.tfs).toBe("GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVEIBAUgBmAEC");
    expect(query.url).toBe(
      "https://www.google.com/travel/flights/search?tfs=GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVEIBAUgBmAEC&hl=en-US"
    );
  });

  it("omits empty hl and curr parameters", () => {
    const query = createQuery({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }]
    });

    expect(query.url.includes("hl=")).toBe(false);
    expect(query.url.includes("curr=")).toBe(false);
  });

  it("includes curr when currency is provided", () => {
    const query = createQuery({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
      currency: "USD"
    });

    expect(query.url.includes("curr=USD")).toBe(true);
  });

  it("includes gl when region is provided", () => {
    const query = createQuery({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
      region: "MY"
    });

    expect(query.url.includes("gl=MY")).toBe(true);
  });

  it("encodes round-trip with two segments (golden)", () => {
    const query = createQuery({
      flights: [
        { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" },
        { date: "2026-05-20", fromAirport: "NRT", toAirport: "KUL" }
      ],
      trip: "round-trip",
      seat: "business",
      passengers: { adults: 2, children: 1 },
      language: "en-US",
      currency: "USD"
    });

    expect(query.tfs).toBe(
      "GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVBoaEgoyMDI2LTA1LTIwagUSA05SVHIFEgNLVUxCAwEBAkgDmAEB"
    );
    expect(query.url).toBe(
      "https://www.google.com/travel/flights/search?tfs=GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVBoaEgoyMDI2LTA1LTIwagUSA05SVHIFEgNLVUxCAwEBAkgDmAEB&hl=en-US&curr=USD"
    );
  });

  it("encodes multi-city with inherited maxStops (golden)", () => {
    const query = createQuery({
      flights: [
        { date: "2026-06-01", fromAirport: "SFO", toAirport: "JFK" },
        { date: "2026-06-05", fromAirport: "JFK", toAirport: "LHR" },
        { date: "2026-06-12", fromAirport: "LHR", toAirport: "SFO" }
      ],
      trip: "multi-city",
      seat: "premium-economy",
      passengers: { adults: 1, infantsOnLap: 1 },
      maxStops: 1,
      language: "en-GB",
      currency: "GBP"
    });

    expect(query.tfs).toBe(
      "GhwSCjIwMjYtMDYtMDEoAWoFEgNTRk9yBRIDSkZLGhwSCjIwMjYtMDYtMDUoAWoFEgNKRktyBRIDTEhSGhwSCjIwMjYtMDYtMTIoAWoFEgNMSFJyBRIDU0ZPQgIBBEgCmAED"
    );
    expect(query.url).toBe(
      "https://www.google.com/travel/flights/search?tfs=GhwSCjIwMjYtMDYtMDEoAWoFEgNTRk9yBRIDSkZLGhwSCjIwMjYtMDYtMDUoAWoFEgNKRktyBRIDTEhSGhwSCjIwMjYtMDYtMTIoAWoFEgNMSFJyBRIDU0ZPQgIBBEgCmAED&hl=en-GB&curr=GBP"
    );
  });

  it("encodes airline-alliance filter and per-flight maxStops (golden)", () => {
    const query = createQuery({
      flights: [
        {
          date: "2026-05-10",
          fromAirport: "KUL",
          toAirport: "NRT",
          airlines: ["STAR_ALLIANCE"],
          maxStops: 0
        }
      ],
      passengers: { adults: 1 }
    });

    expect(query.tfs).toBe("GisSCjIwMjYtMDUtMTAoADINU1RBUl9BTExJQU5DRWoFEgNLVUxyBRIDTlJUQgEBSAGYAQI=");
  });

  it("accepts a Date instance for flight date", () => {
    const query = createQuery({
      flights: [
        { date: new Date(Date.UTC(2026, 4, 10)), fromAirport: "kul", toAirport: "nrt" }
      ],
      language: "en-US"
    });

    expect(query.tfs).toBe("GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVEIBAUgBmAEC");
  });

  it("rejects invalid airport codes", () => {
    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KULX", toAirport: "NRT" }]
      })
    ).toThrow(QueryValidationError);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KU", toAirport: "NRT" }]
      })
    ).toThrow(QueryValidationError);
  });

  it("rejects bad date formats and invalid Date instances", () => {
    expect(() =>
      createQuery({
        flights: [{ date: "2026/05/10", fromAirport: "KUL", toAirport: "NRT" }]
      })
    ).toThrow(QueryValidationError);

    expect(() =>
      createQuery({
        flights: [{ date: new Date("not a date"), fromAirport: "KUL", toAirport: "NRT" }]
      })
    ).toThrow(QueryValidationError);
  });

  it("accepts IATA codes and alliance identifiers, and rejects free text", () => {
    expect(() =>
      createQuery({
        flights: [
          { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT", airlines: ["jl", "nh"] }
        ]
      })
    ).not.toThrow();

    expect(() =>
      createQuery({
        flights: [
          { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT", airlines: ["STAR_ALLIANCE", "SKYTEAM", "ONEWORLD"] }
        ]
      })
    ).not.toThrow();

    expect(() =>
      createQuery({
        flights: [
          { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT", airlines: ["Japan Airlines"] }
        ]
      })
    ).toThrow(QueryValidationError);
  });

  it("rejects negative maxStops", () => {
    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        maxStops: -1
      })
    ).toThrow(QueryValidationError);
  });

  it("enforces trip ↔ segment count consistency", () => {
    expect(() =>
      createQuery({
        flights: [
          { date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" },
          { date: "2026-05-20", fromAirport: "NRT", toAirport: "KUL" }
        ],
        trip: "one-way"
      })
    ).toThrow(/one-way/);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        trip: "round-trip"
      })
    ).toThrow(/round-trip/);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        trip: "multi-city"
      })
    ).toThrow(/multi-city/);
  });

  it("enforces passenger count bounds", () => {
    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        passengers: { adults: 0, children: 0 }
      })
    ).toThrow(/At least one passenger/);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        passengers: { adults: 10 }
      })
    ).toThrow(/at most 9/);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        passengers: { adults: 1, infantsOnLap: 2 }
      })
    ).toThrow(/adult per infant/);
  });

  it("validates post-search filter shapes", () => {
    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        filters: {
          departureTime: { earliest: "25:00" }
        }
      })
    ).toThrow(QueryValidationError);

    expect(() =>
      createQuery({
        flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
        filters: {
          layover: { minMinutes: 120, maxMinutes: 60 }
        }
      })
    ).toThrow(QueryValidationError);
  });
});

describe("buildSearchUrl", () => {
  it("wraps free-text into a q= param", () => {
    const url = buildSearchUrl("Flights from KUL to NRT on 2026-05-10");
    expect(url.startsWith("https://www.google.com/travel/flights/search?q=")).toBe(true);
  });

  it("returns the encoded url when given an EncodedQuery", () => {
    const query = createQuery({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }]
    });
    expect(buildSearchUrl(query)).toBe(query.url);
  });

  it("builds a url when given a StructuredQueryInput directly", () => {
    const url = buildSearchUrl({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }]
    });
    expect(url).toContain("tfs=");
  });
});
