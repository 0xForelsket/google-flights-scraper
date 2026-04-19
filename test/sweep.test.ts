import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sweepFlights } from "../src/sweep.js";

function makeFetch(impl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) {
  return impl as typeof globalThis.fetch;
}

const ds1Script = readFileSync(new URL("./fixtures/kul-nrt-ds1.js", import.meta.url), "utf8");
const OK_HTML = `<html><body><script>${ds1Script}</script></body></html>`;

describe("sweepFlights", () => {
  const baseQuery = (date: string) => ({
    flights: [{ date, fromAirport: "KUL", toAirport: "NRT" }]
  });

  it("returns an empty array for no queries", async () => {
    const results = await sweepFlights([], { fetch: makeFetch(async () => new Response("")) });
    expect(results).toEqual([]);
  });

  it("fans out and collects results in input order", async () => {
    const queries = ["2026-05-10", "2026-05-11", "2026-05-12"].map(baseQuery);
    const seen: string[] = [];
    const fetchImpl = makeFetch(async (url) => {
      seen.push(String(url));
      return new Response(OK_HTML, { status: 200 });
    });

    const results = await sweepFlights(queries, { fetch: fetchImpl, concurrency: 2 });

    expect(results).toHaveLength(3);
    expect(results.every((entry) => entry.result !== undefined)).toBe(true);
    expect(results.every((entry) => entry.error === undefined)).toBe(true);
    expect(seen).toHaveLength(3);
  });

  it("collects errors without aborting the batch", async () => {
    const queries = ["2026-05-10", "2026-05-11", "2026-05-12"].map(baseQuery);
    let call = 0;
    const fetchImpl = makeFetch(async () => {
      call++;
      if (call === 2) return new Response("nope", { status: 500, statusText: "Server Error" });
      return new Response(OK_HTML, { status: 200 });
    });

    const results = await sweepFlights(queries, { fetch: fetchImpl, concurrency: 1 });

    expect(results.filter((r) => r.result).length).toBe(2);
    expect(results.filter((r) => r.error).length).toBe(1);
    expect(results[1]?.error?.name).toBe("FetchFlightsError");
  });

  it("invokes onResult for each settled query", async () => {
    const queries = ["2026-05-10", "2026-05-11"].map(baseQuery);
    const callbackEvents: number[] = [];
    const fetchImpl = makeFetch(async () => new Response(OK_HTML, { status: 200 }));

    await sweepFlights(queries, {
      fetch: fetchImpl,
      concurrency: 1,
      onResult: (_entry, index) => {
        callbackEvents.push(index);
      }
    });

    expect(callbackEvents.sort()).toEqual([0, 1]);
  });

  it("respects concurrency cap", async () => {
    const queries = Array.from({ length: 6 }, (_, i) => baseQuery(`2026-05-${String(10 + i).padStart(2, "0")}`));
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = makeFetch(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response(OK_HTML, { status: 200 });
    });

    await sweepFlights(queries, { fetch: fetchImpl, concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
