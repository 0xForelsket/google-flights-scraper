# google-flights-scraper

`google-flights-scraper` is a Node.js library for building Google Flights queries, fetching results, and parsing both HTML bootstrap payloads and Google's internal RPC response shape.

It now supports:

- HTML, RPC, or HTML-with-RPC-fallback transport
- typed result parsing with CO2, booking tokens, carrier links, baggage links, locations, and flexible-date price data
- retry, proxy rotation, telemetry hooks, and session dedupe
- progressive sweeps via `for await`
- dual ESM + CJS publishing
- exported Zod schemas for validating cached payloads

## Install

```bash
npm install google-flights-scraper
```

## Requirements

- Node `>=20`
- server-side runtime only

## Quick Start

```ts
import { fetchFlights } from "google-flights-scraper";

const result = await fetchFlights({
  flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
  seat: "economy",
  passengers: { adults: 1 },
  language: "en-US",
  currency: "USD",
  region: "MY"
});

console.log(result.flights[0]);
console.log(result.metadata.flexibleDateInsight?.pricePoints.slice(0, 3));
```

CommonJS works too:

```js
const { fetchFlights } = require("google-flights-scraper");
```

## Transports

`fetchFlights` accepts `transport`:

- `"html"`: default. Best for CO2, booking tokens, carrier links, flexible-date data, baggage metadata.
- `"rpc"`: faster structured-query transport against Google's internal `GetShoppingResults` RPC shape.
- `"auto"`: try HTML first, then fall back to RPC when HTML parsing fails for structured or encoded queries.

```ts
const result = await fetchFlights(query, { transport: "auto" });
```

If you want raw transport payloads:

```ts
import { fetchFlightsHtml, fetchFlightsRpcText } from "google-flights-scraper";

const html = await fetchFlightsHtml(query);
const rpcText = await fetchFlightsRpcText(query, { transport: "rpc" });
```

## Query Input

```ts
type StructuredQueryInput = {
  flights: {
    date: string | Date;
    fromAirport: string; // 3-letter airport or city/metro code
    toAirport: string;   // 3-letter airport or city/metro code
    maxStops?: number;
    airlines?: string[];
  }[];
  seat?: "economy" | "premium-economy" | "business" | "first";
  trip?: "round-trip" | "one-way" | "multi-city";
  passengers?: {
    adults?: number;
    children?: number;
    infantsInSeat?: number;
    infantsOnLap?: number;
  };
  language?: string; // hl
  currency?: string; // curr
  region?: string;   // gl
  maxStops?: number;
  filters?: {
    departureTime?: { earliest?: "HH:MM"; latest?: "HH:MM" };
    arrivalTime?: { earliest?: "HH:MM"; latest?: "HH:MM" };
    layover?: { minMinutes?: number; maxMinutes?: number };
    connectionAirports?: { allow?: string[]; block?: string[] };
  };
};
```

The time / layover / connection filters are applied post-parse so they work consistently across HTML and RPC transports.

## Result Shape

```ts
type FlightsSearchResult = {
  flights: FlightResult[];
  metadata: {
    airlines: { code: string; name: string }[];
    alliances: { code: string; name: string }[];
    baggageLinks: CarrierLink[];
    locations: LocationMetadata[];
    flexibleDateInsight: FlexibleDateInsight | null;
  };
};
```

Each `FlightResult` includes:

- price, segments, layovers, total duration, stop count
- CO2 data
- `bookingToken`
- `carrierLinks`
- matched `baggageLinks`
- `farePolicy` best-effort hints

## Retry, Proxy, Telemetry, Cache

```ts
import { fetchFlights } from "google-flights-scraper";

const result = await fetchFlights(query, {
  transport: "auto",
  timeoutMs: 15_000,
  proxy: async () => process.env.FLIGHTS_PROXY_POOL!.split(",")[0]!,
  retry: {
    attempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 10_000
  },
  onRequest: (event) => console.log("request", event.transport, event.url),
  onResponse: (event) => console.log("response", event.status, event.bytes),
  onParseError: (event) => console.log("parse-error", event.transport, event.error.name),
  onCacheHit: (event) => console.log("cache-hit", event.key)
});
```

`cache` defaults to a process-local LRU session cache. You can disable it or inject your own cache instance:

```ts
import { SessionCache, fetchFlights } from "google-flights-scraper";

const cache = new SessionCache({ maxEntries: 250, ttlMs: 60_000 });

await fetchFlights(query, { cache });
await fetchFlights(query, { cache }); // deduped
```

## Progressive Sweeps

`await sweepFlights(...)` still returns the full `SweepEntry[]`, but the return value is also async-iterable:

```ts
import { sweepFlights } from "google-flights-scraper";

const run = sweepFlights(queries, {
  concurrency: 3,
  minDelayMs: 250,
  transport: "auto"
});

for await (const entry of run) {
  console.log(entry.input.flights[0].date, entry.result?.flights[0]?.price);
}

const allEntries = await run;
```

## Query Helpers

### Encode / Decode

```ts
import { createQuery, decodeQuery } from "google-flights-scraper";

const encoded = createQuery({
  flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
  region: "MY"
});

console.log(encoded.url);
console.log(decodeQuery(encoded.tfs));
```

### Nearby-Airport Expansion

The parser exposes `metadata.locations`, and the helper below expands a city / metro code to airport codes from that metadata:

```ts
import { expandLocationCode, fetchFlights } from "google-flights-scraper";

const result = await fetchFlights(query);
const airports = expandLocationCode("TYO", result.metadata.locations);
```

## Exported Schemas

```ts
import { flightsSearchResultSchema } from "google-flights-scraper";

const parsed = flightsSearchResultSchema.parse(JSON.parse(cachedJson));
```

Other exported schemas include:

- `flightResultSchema`
- `flightSegmentSchema`
- `carrierLinkSchema`
- `locationMetadataSchema`
- `flexibleDateInsightSchema`

## Errors

```ts
import {
  CaptchaError,
  FetchFlightsError,
  HttpError,
  ParseFlightsError,
  QueryValidationError,
  RateLimitError,
  TimeoutError
} from "google-flights-scraper";

try {
  await fetchFlights(query, { transport: "auto" });
} catch (error) {
  if (error instanceof RateLimitError) {
    // 429
  } else if (error instanceof TimeoutError) {
    // request budget elapsed
  } else if (error instanceof HttpError) {
    // non-429 HTTP error
  } else if (error instanceof CaptchaError) {
    // anti-bot page
  } else if (error instanceof FetchFlightsError) {
    // network / fetch layer issue
  } else if (error instanceof ParseFlightsError) {
    // unexpected Google payload shape
  } else if (error instanceof QueryValidationError) {
    // invalid input
  }
}
```

## Public API

- `createQuery(input)`
- `buildSearchUrl(input)`
- `decodeQuery(tfs)`
- `fetchFlightsHtml(input, options?)`
- `fetchFlightsRpcText(input, options?)`
- `fetchFlights(input, options?)`
- `sweepFlights(queries, options?)`
- `clearSessionCache()`
- `expandLocationCode(code, locations)`
- `createLocationIndex(locations)`

## Limitations

- Google Flights can change its HTML, RPC envelope, and payload shape at any time.
- HTML remains the richer transport. RPC is faster but Google's internal payload does not expose every field the same way.
- Proxy support relies on `undici` dispatchers; if you inject a custom `fetch`, proxy handling depends on that implementation honoring the passed init shape.
- Some fare-policy signals, especially refundability, are still best-effort because Google does not expose stable public labels in this payload.

## Legal

Scraping Google Flights may violate Google's Terms of Service. You are responsible for how you use this library. Verify the applicable terms, obtain data through official channels where possible, and do not use this package to overwhelm Google's infrastructure.

## Publishing

```bash
npm run check
npm run pack:check
```
