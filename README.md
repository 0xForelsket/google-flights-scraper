# google-flights-scraper

`google-flights-scraper` is a small Node.js library for Google Flights scraping.

It does three things:

1. Builds the Google Flights `tfs` query payload from structured input.
2. Fetches the Google Flights search page with browser-like headers.
3. Parses the live `AF_initDataCallback({ key: 'ds:1' ... })` bootstrap payload into typed itinerary data.

This package is meant to be the core you build on top of, whether that is:

- a dashboard
- a CLI
- a cron job
- a price-alert service
- a backend API

## Install

```bash
npm install google-flights-scraper
```

## Requirements

- Node `>=20`
- Server-side runtime only

This package uses native `fetch` and targets Node, not the browser.

## Quick Start

```ts
import { createQuery, fetchFlights } from "google-flights-scraper";

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
  passengers: {
    adults: 1
  },
  language: "en-US"
});

const result = await fetchFlights(query);

console.log(result.flights[0]);
console.log(result.metadata.airlines.slice(0, 5));
```

## What You Get Back

`fetchFlights()` and `parseFlightsHtml()` return:

```ts
type FlightsSearchResult = {
  flights: FlightResult[];
  metadata: {
    airlines: { code: string; name: string }[];
    alliances: { code: string; name: string }[];
  };
};
```

Each `FlightResult` includes:

- price (a numeric amount; Google does not attach a currency code to the payload — pass `currency` on the query if you need a specific one)
- airline names
- segment-level departure and arrival data, operating carrier code, combined flight number (e.g. `"TR451"`), plane type, and legroom string
- total duration (minutes)
- stop count
- layovers (durations in minutes, plus `changeOfAirport` when the onward flight departs from a different airport)
- carbon emissions (`emission` and `typicalOnRoute` are CO₂ grams)
- `bookingToken` — opaque token Google uses on its own "Select flights" step (pass-through; may break when Google changes its surface)
- `carrierLinks` — carrier-provided URLs Google associates with this itinerary (often support/accessibility, not booking)

## Usage Patterns

### Structured Query

```ts
import { createQuery, buildSearchUrl } from "google-flights-scraper";

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
  language: "en-US",
  currency: "USD"
});

console.log(query.tfs);
console.log(query.url);
console.log(buildSearchUrl(query));
```

### Free-Text Query

If you want to let Google interpret the query itself, you can pass a string:

```ts
import { buildSearchUrl, fetchFlights } from "google-flights-scraper";

const input = "Flights from Kuala Lumpur to Tokyo on 2026-05-10 one way economy";

console.log(buildSearchUrl(input));

const result = await fetchFlights(input);
```

### Separate Fetch and Parse

This is useful if you want to cache HTML, inspect it, or retry parsing separately.

```ts
import { createQuery, fetchFlightsHtml, parseFlightsHtml } from "google-flights-scraper";

const query = createQuery({
  flights: [
    {
      date: "2026-05-10",
      fromAirport: "KUL",
      toAirport: "NRT"
    }
  ]
});

const html = await fetchFlightsHtml(query);
const result = parseFlightsHtml(html);
```

### Inject Your Own Fetch

If you want custom proxying, retries, tracing, or rate limiting, pass your own `fetch`.

```ts
import { fetchFlights } from "google-flights-scraper";

const result = await fetchFlights("Flights from KUL to NRT on 2026-05-10", {
  fetch: async (input, init) => {
    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        "x-my-header": "value"
      }
    });
  }
});
```

### Custom Headers, Timeout, and Signal

```ts
await fetchFlights(query, {
  // Merged on top of the default browser-like header set.
  headers: { "user-agent": "my-custom-ua/1.0" },
  // Drop defaults entirely and use only the headers above.
  replaceHeaders: true,
  // Override the default 30s timeout. Pass 0 to disable.
  timeoutMs: 10_000,
  // Your own abort signal is honored in addition to the timeout.
  signal: controller.signal
});
```

### Distinguishing Errors

```ts
import { FetchFlightsError, ParseFlightsError, QueryValidationError } from "google-flights-scraper";

try {
  await fetchFlights(query);
} catch (error) {
  if (error instanceof FetchFlightsError) {
    // error.status holds the HTTP status when the response returned one
    if (error.status === 429) {
      // back off
    }
  } else if (error instanceof ParseFlightsError) {
    // Google changed the payload, or we got a non-results page
  } else if (error instanceof QueryValidationError) {
    // bad input
  }
}
```

## Public API

### `createQuery(input)`

Builds a structured Google Flights query and returns:

- `tfs`
- `language`
- `currency`
- `params`
- `url`

### `buildSearchUrl(input)`

Builds a Google Flights search URL from either:

- a structured query input
- an encoded query from `createQuery`
- a free-text search string

### `fetchFlightsHtml(input, options)`

Fetches raw Google Flights HTML.

Useful if you want:

- HTML caching
- custom parsing
- response inspection
- delayed parsing

### `parseFlightsHtml(html)`

Parses the `ds:1` bootstrap payload out of Google Flights HTML and returns structured results.

### `fetchFlights(input, options)`

Convenience wrapper for:

1. `fetchFlightsHtml(...)`
2. `parseFlightsHtml(...)`

## Query Input

```ts
type StructuredQueryInput = {
  flights: {
    date: string | Date;
    fromAirport: string;
    toAirport: string;
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
  language?: string;
  currency?: string;
  maxStops?: number;
};
```

## Error Types

The package throws typed errors so you can separate bad input from scrape failures:

- `QueryValidationError`
- `FetchFlightsError`
- `ParseFlightsError`

## Limitations & Reliability

- Google Flights can change its markup and payload structure at any time. Parsing is best-effort and will break when that happens.
- This package is intentionally server-side. Running it directly in the browser is not a real target.
- `multi-city` is encoded because Google supports the trip type, but result behavior should still be treated as unstable until it is tested properly.
- **Free-text search is not equivalent to a structured query.** Google may return a landing/redirect page or an entirely different layout when it can't confidently interpret the string, in which case `parseFlightsHtml` throws `ParseFlightsError`. Prefer `createQuery(...)` whenever you can.
- Google rate-limits scraping aggressively. For anything beyond occasional queries, plan on proxies, backoff, and caching (the `fetchFlightsHtml` / `parseFlightsHtml` split is there for exactly this).

## Legal

Scraping Google Flights may violate Google's Terms of Service. You are responsible for how you use this library. Verify the applicable terms, obtain data through official channels where possible, and do not use this package to overwhelm Google's infrastructure.

## Publishing Notes

This repo is set up so `npm publish` runs validation first:

```bash
npm run prepublishOnly
```

You can also inspect the package tarball before publishing:

```bash
npm run pack:check
```

The package is currently licensed under `MIT`.
