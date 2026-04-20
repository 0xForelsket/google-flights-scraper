import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseFlightsHtml } from "../src/parse.js";
import { ParseFlightsError } from "../src/errors.js";

describe("parseFlightsHtml", () => {
  it("throws ParseFlightsError on a Google landing/redirect page without ds:1", () => {
    const html = `<!doctype html><html><head><title>Google Flights</title></head><body><script>AF_initDataCallback({key: 'ds:0', data: [1,2,3], sideChannel: {}});</script></body></html>`;
    expect(() => parseFlightsHtml(html)).toThrow(ParseFlightsError);
  });

  it("parses a live ds:1 fixture into structured itineraries", () => {
    const ds1Script = readFileSync(new URL("./fixtures/kul-nrt-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(result.flights).toHaveLength(8);
    expect(result.metadata.airlines.some((airline) => airline.code === "NH" && airline.name === "ANA")).toBe(true);
    expect(result.metadata.alliances.some((alliance) => alliance.code === "STAR_ALLIANCE")).toBe(true);
    expect(result.metadata.baggageLinks.some((link) => link.code === "TR" && link.type === "baggage")).toBe(true);
    expect(result.metadata.flexibleDateInsight?.pricePoints.length).toBeGreaterThan(20);
    expect(result.metadata.locations.some((location) => location.code === "KUL" && location.kind === "airport")).toBe(true);

    expect(result.flights[0]).toMatchObject({
      type: "TR",
      price: 1449,
      airlines: ["Scoot"],
      segments: [
        {
          fromAirport: { code: "KUL", name: "Kuala Lumpur International Airport" },
          toAirport: { code: "SIN", name: "Singapore Changi Airport" },
          departure: { date: { year: 2026, month: 5, day: 10 }, time: { hour: 11, minute: 35 } },
          arrival: { date: { year: 2026, month: 5, day: 10 }, time: { hour: 12, minute: 50 } },
          durationMinutes: 75,
          planeType: "Airbus A320neo",
          operatingCarrier: "TR",
          flightNumber: "TR451",
          legroom: "28 in"
        },
        {
          fromAirport: { code: "SIN", name: "Singapore Changi Airport" },
          toAirport: { code: "TPE", name: "Taiwan Taoyuan International Airport" },
          departure: { date: { year: 2026, month: 5, day: 11 }, time: { hour: 1, minute: 0 } },
          arrival: { date: { year: 2026, month: 5, day: 11 }, time: { hour: 5, minute: 45 } },
          durationMinutes: 285,
          planeType: "Boeing 787",
          operatingCarrier: "TR",
          flightNumber: "TR866",
          legroom: "31 in"
        },
        {
          fromAirport: { code: "TPE", name: "Taiwan Taoyuan International Airport" },
          toAirport: { code: "NRT", name: "Narita International Airport" },
          departure: { date: { year: 2026, month: 5, day: 11 }, time: { hour: 6, minute: 45 } },
          arrival: { date: { year: 2026, month: 5, day: 11 }, time: { hour: 11, minute: 15 } },
          durationMinutes: 210,
          planeType: "Boeing 787",
          operatingCarrier: "TR",
          flightNumber: "TR866",
          legroom: "31 in"
        }
      ],
      totalDurationMinutes: 1360,
      stopCount: 1,
      layovers: [
        {
          durationMinutes: 730,
          airportCode: "SIN",
          airportName: "Singapore Changi Airport",
          cityName: "Singapore",
          changeOfAirport: false
        },
        {
          durationMinutes: 60,
          airportCode: "TPE",
          airportName: "Taiwan Taoyuan International Airport",
          cityName: "Taipei City",
          changeOfAirport: false
        }
      ],
      carbon: {
        emission: 383000,
        typicalOnRoute: 405000
      },
      farePolicy: {
        refundabilityCode: 2,
        checkedBaggageIncluded: null
      },
      bookingToken:
        "CjRIZF9WWGl2Rm94b1lBUHVxSlFCRy0tLS0tLS0tc21iZWkyM0FBQUFBR25rcGY4RTlweGVBEhFUUjQ1MXxUUjg2NnxUUjg2NhoLCPDrCBACGgNNWVI4HXCvngI=",
      carrierLinks: [
        {
          code: "TR",
          name: "Scoot",
          type: "support",
          url: "https://www.flyscoot.com/en/support/special-assistance"
        }
      ],
      baggageLinks: [
        {
          code: "TR",
          name: "Scoot",
          type: "baggage",
          url: "https://www.flyscoot.com/en/fly-scoot/before-you-fly/baggage"
        }
      ]
    });
  });

  it("drops price-less itinerary shells and parses priced multi-segment routes", () => {
    const ds1Script = readFileSync(new URL("./fixtures/pen-sha-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(result.flights).toHaveLength(6);
    expect(result.flights.every((flight) => flight.price > 0)).toBe(true);
    expect(result.flights.every((flight) => flight.bookingToken.length > 0)).toBe(true);

    const multi = result.flights.find(
      (flight) =>
        flight.type === "multi" &&
        flight.airlines.includes("Malaysia Airlines") &&
        flight.airlines.includes("China Southern")
    );

    expect(multi).toMatchObject({
      type: "multi",
      price: 389,
      airlines: ["Malaysia Airlines", "China Southern"],
      segments: [
        {
          fromAirport: { code: "PEN", name: "Penang International Airport" },
          toAirport: { code: "KUL", name: "Kuala Lumpur International Airport" },
          departure: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 9, minute: 50 } },
          arrival: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 10, minute: 55 } },
          durationMinutes: 65,
          planeType: "Boeing 737",
          operatingCarrier: "MH",
          flightNumber: "MH1143",
          legroom: "30 in"
        },
        {
          fromAirport: { code: "KUL", name: "Kuala Lumpur International Airport" },
          toAirport: { code: "CAN", name: "Guangzhou Baiyun International Airport" },
          departure: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 14, minute: 0 } },
          arrival: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 18, minute: 10 } },
          durationMinutes: 250,
          planeType: "Airbus A350",
          operatingCarrier: "CZ",
          flightNumber: "CZ350",
          legroom: "32 in"
        },
        {
          fromAirport: { code: "CAN", name: "Guangzhou Baiyun International Airport" },
          toAirport: { code: "SHA", name: "Shanghai Hongqiao International Airport" },
          departure: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 20, minute: 0 } },
          arrival: { date: { year: 2026, month: 7, day: 1 }, time: { hour: 22, minute: 20 } },
          durationMinutes: 140,
          planeType: "Boeing 777",
          operatingCarrier: "CZ",
          flightNumber: "CZ3595",
          legroom: "31 in"
        }
      ],
      totalDurationMinutes: 750,
      stopCount: 0,
      layovers: [
        {
          durationMinutes: 185,
          airportCode: "KUL",
          airportName: "Kuala Lumpur International Airport",
          cityName: "Federal Territory of Kuala Lumpur",
          changeOfAirport: false
        },
        {
          durationMinutes: 110,
          airportCode: "CAN",
          airportName: "Guangzhou Baiyun International Airport",
          cityName: "Guangzhou",
          changeOfAirport: false
        }
      ],
      carbon: {
        emission: 407000,
        typicalOnRoute: 312000
      },
      farePolicy: {
        refundabilityCode: 1,
        checkedBaggageIncluded: null
      },
      bookingToken:
        "CjRIMS1zeTNnV1BTU3NBTS1ZVWdCRy0tLS0tLS0tLS1zZXB4MkFBQUFBR25rcUpjSzgtbkNBEhNNSDExNDN8Q1ozNTB8Q1ozNTk1GgsItK8CEAIaA1VTRDgdcLSvAg==",
      carrierLinks: [
        {
          code: "MH",
          name: "Malaysia Airlines",
          type: "support",
          url: "https://www.malaysiaairlines.com/my/en/travel-info/mhguardian.html"
        },
        {
          code: "CZ",
          name: "China Southern",
          type: "support",
          url: "https://www.csair.com/mcms/mcmsNewSite/en/us/#/tourguide/special_passenger"
        }
      ],
      baggageLinks: [
        {
          code: "MH",
          name: "Malaysia Airlines",
          type: "baggage",
          url: "https://www.malaysiaairlines.com/hq/en/plan-your-trip/baggage/checked-baggage.html"
        },
        {
          code: "CZ",
          name: "China Southern",
          type: "baggage",
          url: "https://www.csair.com/mcms/mcmsNewSite/en/us/#/tourguide/luggage_service/checked_luggage/live_animals"
        }
      ]
    });
  });
});
