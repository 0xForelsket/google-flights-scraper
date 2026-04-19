import { FetchFlightsError } from "./errors.js";
import { buildSearchUrl, type EncodedQuery, type StructuredQueryInput } from "./query.js";
import { parseFlightsHtml, type FlightsSearchResult } from "./parse.js";

export interface FetchFlightsOptions {
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

const DEFAULT_HEADERS: HeadersInit = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};

function resolveFetch(fetchImpl?: typeof globalThis.fetch): typeof globalThis.fetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new FetchFlightsError("No fetch implementation is available. Provide one through options.fetch.");
  }

  return globalThis.fetch.bind(globalThis);
}

export async function fetchFlightsHtml(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<string> {
  const fetchImpl = resolveFetch(options.fetch);
  const init: RequestInit = {
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers
    }
  };

  if (options.signal) {
    init.signal = options.signal;
  }

  const response = await fetchImpl(buildSearchUrl(input), init);

  if (!response.ok) {
    throw new FetchFlightsError(`Google Flights returned ${response.status} ${response.statusText}.`);
  }

  const html = await response.text();

  if (html.length === 0) {
    throw new FetchFlightsError("Google Flights returned an empty HTML response.");
  }

  return html;
}

export async function fetchFlights(
  input: string | StructuredQueryInput | EncodedQuery,
  options: FetchFlightsOptions = {}
): Promise<FlightsSearchResult> {
  const html = await fetchFlightsHtml(input, options);
  return parseFlightsHtml(html);
}
