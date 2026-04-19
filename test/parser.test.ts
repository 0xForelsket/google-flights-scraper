import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseFlightsHtml } from "../src/parse.js";

describe("parseFlightsHtml", () => {
  it("parses a live ds:1 fixture into structured itineraries", () => {
    const ds1Script = readFileSync(new URL("./fixtures/kul-nrt-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(result.flights).toHaveLength(8);
    expect(result.metadata.airlines.some((airline) => airline.code === "NH" && airline.name === "ANA")).toBe(true);
    expect(result.metadata.alliances.some((alliance) => alliance.code === "STAR_ALLIANCE")).toBe(true);

    expect(result.flights[0]).toEqual({
      type: "TR",
      price: 1449,
      airlines: ["Scoot"],
      segments: [
        {
          fromAirport: {
            code: "KUL",
            name: "Kuala Lumpur International Airport"
          },
          toAirport: {
            code: "SIN",
            name: "Singapore Changi Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 5,
              day: 10
            },
            time: {
              hour: 11,
              minute: 35
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 5,
              day: 10
            },
            time: {
              hour: 12,
              minute: 50
            }
          },
          durationMinutes: 75,
          planeType: "Airbus A320neo"
        },
        {
          fromAirport: {
            code: "SIN",
            name: "Singapore Changi Airport"
          },
          toAirport: {
            code: "TPE",
            name: "Taiwan Taoyuan International Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 5,
              day: 11
            },
            time: {
              hour: 1,
              minute: 0
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 5,
              day: 11
            },
            time: {
              hour: 5,
              minute: 45
            }
          },
          durationMinutes: 285,
          planeType: "Boeing 787"
        },
        {
          fromAirport: {
            code: "TPE",
            name: "Taiwan Taoyuan International Airport"
          },
          toAirport: {
            code: "NRT",
            name: "Narita International Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 5,
              day: 11
            },
            time: {
              hour: 6,
              minute: 45
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 5,
              day: 11
            },
            time: {
              hour: 11,
              minute: 15
            }
          },
          durationMinutes: 210,
          planeType: "Boeing 787"
        }
      ],
      totalDurationMinutes: 1360,
      stopCount: 1,
      layovers: [
        {
          durationMinutes: 730,
          airportCode: "SIN",
          airportName: "Singapore Changi Airport",
          cityName: "Singapore"
        },
        {
          durationMinutes: 60,
          airportCode: "TPE",
          airportName: "Taiwan Taoyuan International Airport",
          cityName: "Taipei City"
        }
      ],
      carbon: {
        emission: 383000,
        typicalOnRoute: 405000
      }
    });
  });

  it("drops price-less itinerary shells and parses priced multi-segment routes", () => {
    const ds1Script = readFileSync(new URL("./fixtures/pen-sha-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(result.flights).toHaveLength(6);
    expect(result.flights.every((flight) => flight.price > 0)).toBe(true);

    const multi = result.flights.find(
      (flight) =>
        flight.type === "multi" &&
        flight.airlines.includes("Malaysia Airlines") &&
        flight.airlines.includes("China Southern")
    );

    expect(multi).toEqual({
      type: "multi",
      price: 389,
      airlines: ["Malaysia Airlines", "China Southern"],
      segments: [
        {
          fromAirport: {
            code: "PEN",
            name: "Penang International Airport"
          },
          toAirport: {
            code: "KUL",
            name: "Kuala Lumpur International Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 9,
              minute: 50
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 10,
              minute: 55
            }
          },
          durationMinutes: 65,
          planeType: "Boeing 737"
        },
        {
          fromAirport: {
            code: "KUL",
            name: "Kuala Lumpur International Airport"
          },
          toAirport: {
            code: "CAN",
            name: "Guangzhou Baiyun International Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 14,
              minute: 0
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 18,
              minute: 10
            }
          },
          durationMinutes: 250,
          planeType: "Airbus A350"
        },
        {
          fromAirport: {
            code: "CAN",
            name: "Guangzhou Baiyun International Airport"
          },
          toAirport: {
            code: "SHA",
            name: "Shanghai Hongqiao International Airport"
          },
          departure: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 20,
              minute: 0
            }
          },
          arrival: {
            date: {
              year: 2026,
              month: 7,
              day: 1
            },
            time: {
              hour: 22,
              minute: 20
            }
          },
          durationMinutes: 140,
          planeType: "Boeing 777"
        }
      ],
      totalDurationMinutes: 750,
      stopCount: 0,
      layovers: [
        {
          durationMinutes: 185,
          airportCode: "KUL",
          airportName: "Kuala Lumpur International Airport",
          cityName: "Federal Territory of Kuala Lumpur"
        },
        {
          durationMinutes: 110,
          airportCode: "CAN",
          airportName: "Guangzhou Baiyun International Airport",
          cityName: "Guangzhou"
        }
      ],
      carbon: {
        emission: 407000,
        typicalOnRoute: 312000
      }
    });
  });
});
