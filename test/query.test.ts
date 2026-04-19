import { describe, expect, it } from "vitest";

import { createQuery } from "../src/query.js";

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
      "https://www.google.com/travel/flights/search?tfs=GhoSCjIwMjYtMDUtMTBqBRIDS1VMcgUSA05SVEIBAUgBmAEC&hl=en-US&curr="
    );
  });
});
