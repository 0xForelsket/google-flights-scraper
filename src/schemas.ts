import { z } from "zod";

export const simpleDateSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  day: z.number().int()
});

export const simpleTimeSchema = z.object({
  hour: z.number().int(),
  minute: z.number().int()
});

export const flightTimestampSchema = z.object({
  date: simpleDateSchema,
  time: simpleTimeSchema
});

export const airportSchema = z.object({
  code: z.string(),
  name: z.string()
});

export const flightSegmentSchema = z.object({
  fromAirport: airportSchema,
  toAirport: airportSchema,
  departure: flightTimestampSchema,
  arrival: flightTimestampSchema,
  durationMinutes: z.number().int(),
  planeType: z.string(),
  operatingCarrier: z.string(),
  flightNumber: z.string(),
  legroom: z.string()
});

export const layoverSchema = z.object({
  durationMinutes: z.number().int(),
  airportCode: z.string(),
  airportName: z.string(),
  cityName: z.string(),
  changeOfAirport: z.boolean()
});

export const carrierLinkSchema = z.object({
  code: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.enum(["support", "baggage"]).optional()
});

export const carbonEmissionSchema = z.object({
  emission: z.number().int(),
  typicalOnRoute: z.number().int()
});

export const farePolicySchema = z.object({
  refundabilityCode: z.number().int().nullable(),
  checkedBaggageIncluded: z.boolean().nullable()
});

export const flexibleDatePricePointSchema = z.object({
  epochMs: z.number().int(),
  date: simpleDateSchema,
  price: z.number().int()
});

export const flexibleDateInsightSchema = z.object({
  destinationLabel: z.string(),
  cheapestPrice: z.number().int().nullable(),
  highestPrice: z.number().int().nullable(),
  pricePoints: z.array(flexibleDatePricePointSchema)
});

export const locationMetadataSchema = z.object({
  code: z.string(),
  kind: z.enum(["airport", "city", "place"]),
  name: z.string(),
  cityName: z.string(),
  cityCode: z.string(),
  countryCode: z.string(),
  countryName: z.string()
});

export const airlineMetadataSchema = z.object({
  code: z.string(),
  name: z.string()
});

export const allianceMetadataSchema = z.object({
  code: z.string(),
  name: z.string()
});

export const flightResultSchema = z.object({
  type: z.string(),
  price: z.number().int(),
  airlines: z.array(z.string()),
  segments: z.array(flightSegmentSchema),
  totalDurationMinutes: z.number().int(),
  stopCount: z.number().int(),
  layovers: z.array(layoverSchema),
  carbon: carbonEmissionSchema,
  farePolicy: farePolicySchema,
  bookingToken: z.string(),
  carrierLinks: z.array(carrierLinkSchema),
  baggageLinks: z.array(carrierLinkSchema)
});

export const flightsSearchResultSchema = z.object({
  flights: z.array(flightResultSchema),
  metadata: z.object({
    airlines: z.array(airlineMetadataSchema),
    alliances: z.array(allianceMetadataSchema),
    baggageLinks: z.array(carrierLinkSchema),
    locations: z.array(locationMetadataSchema),
    flexibleDateInsight: flexibleDateInsightSchema.nullable()
  })
});
