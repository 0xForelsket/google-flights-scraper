import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { clearSessionCache, fetchFlights, fetchFlightsHtml, fetchFlightsRpcText } from "../src/fetch.js";
import { FetchFlightsError, HttpError, RateLimitError, TimeoutError } from "../src/errors.js";

function makeFetch(impl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) {
  return impl as typeof globalThis.fetch;
}

const ds1Script = readFileSync(new URL("./fixtures/kul-nrt-ds1.js", import.meta.url), "utf8");
const OK_HTML = `<html><body><script>${ds1Script}</script></body></html>`;

function makeRpcEnvelope(bookingToken = "rpc-token"): string {
  const payload = [
    null,
    null,
    [],
    [[
      [
        [
          "TR",
          ["Scoot"],
          [[
            null,
            null,
            null,
            "KUL",
            "Kuala Lumpur International Airport",
            "Narita International Airport",
            "NRT",
            null,
            [7, 15],
            null,
            [15, 25],
            430,
            [null, 1, null, null, null, null, null, null, null, 1, null, 3],
            1,
            "31 in",
            null,
            1,
            "Boeing 787",
            null,
            0,
            [2026, 5, 10],
            [2026, 5, 10],
            ["TR", "451", null, "Scoot"],
            null,
            null,
            1,
            null,
            null,
            null,
            null,
            "31 inches",
            364871,
            1
          ]],
          "KUL",
          [2026, 5, 10],
          [7, 15],
          "NRT",
          [2026, 5, 10],
          [15, 25],
          430,
          null,
          null,
          0,
          null,
          null,
          null,
          null,
          "token",
          [[1, 2, 3], null, null, null, null, [[1]]],
          1,
          null,
          null,
          [null, null, 1, -10, null, 1, 1, 365000, 405000, [1], 383000, 2, 0, null, null, 1, null, 1],
          [1],
          [["TR", "Scoot", "https://www.flyscoot.com/en/support/special-assistance"]]
        ],
        [[null, 1449], bookingToken],
        null,
        0,
        [],
        [],
        0,
        []
      ]
    ]],
    [[
      [["ONEWORLD", "Oneworld"]],
      [["TR", "Scoot"]]
    ]]
  ];

  return `)]}'\n${JSON.stringify([[null, null, JSON.stringify(payload)]])}`;
}

describe("fetchFlightsHtml", () => {
  const input = "Flights from KUL to NRT on 2026-05-10";
  const structuredInput = {
    flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
    language: "en-US",
    currency: "USD",
    region: "MY"
  } as const;

  it("merges default headers with user-supplied headers", async () => {
    let observed: Headers | undefined;
    const fetchImpl = makeFetch(async (_url, init) => {
      observed = new Headers(init?.headers);
      return new Response("<html>ok</html>", { status: 200 });
    });

    await fetchFlightsHtml(input, {
      fetch: fetchImpl,
      headers: { "x-custom": "1" }
    });

    expect(observed?.get("x-custom")).toBe("1");
    expect(observed?.get("user-agent")).toContain("Mozilla/5.0");
  });

  it("drops default headers when replaceHeaders is true", async () => {
    let observed: Headers | undefined;
    const fetchImpl = makeFetch(async (_url, init) => {
      observed = new Headers(init?.headers);
      return new Response("<html>ok</html>", { status: 200 });
    });

    await fetchFlightsHtml(input, {
      fetch: fetchImpl,
      replaceHeaders: true,
      headers: { "user-agent": "replaced/1.0" }
    });

    expect(observed?.get("user-agent")).toBe("replaced/1.0");
    expect(observed?.get("accept-language")).toBeNull();
  });

  it("throws FetchFlightsError with status when response is not ok", async () => {
    const fetchImpl = makeFetch(async () => new Response("nope", { status: 429, statusText: "Too Many Requests" }));

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl })).rejects.toMatchObject({
      name: "RateLimitError",
      status: 429
    });
  });

  it("throws HttpError for non-429 HTTP failures", async () => {
    const fetchImpl = makeFetch(async () => new Response("nope", { status: 503, statusText: "Service Unavailable" }));

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl })).rejects.toBeInstanceOf(HttpError);
  });

  it("throws FetchFlightsError with cause when fetch throws", async () => {
    const original = new Error("ECONNRESET");
    const fetchImpl = makeFetch(async () => {
      throw original;
    });

    try {
      await fetchFlightsHtml(input, { fetch: fetchImpl });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FetchFlightsError);
      expect((error as FetchFlightsError).cause).toBe(original);
    }
  });

  it("throws when response body is empty", async () => {
    const fetchImpl = makeFetch(async () => new Response("", { status: 200 }));

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl })).rejects.toBeInstanceOf(FetchFlightsError);
  });

  it("respects a caller-supplied AbortSignal", async () => {
    const fetchImpl = makeFetch((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      })
    );

    const controller = new AbortController();
    const promise = fetchFlightsHtml(input, { fetch: fetchImpl, signal: controller.signal, timeoutMs: 0 });
    controller.abort(new Error("user cancelled"));

    await expect(promise).rejects.toBeInstanceOf(FetchFlightsError);
  });

  it("aborts when timeoutMs elapses", async () => {
    const fetchImpl = makeFetch((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      })
    );

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl, timeoutMs: 10 })).rejects.toBeInstanceOf(TimeoutError);
  });

  it("retries on 429 and succeeds", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      if (calls < 3) return new Response("nope", { status: 429, statusText: "Too Many Requests" });
      return new Response("<html>ok</html>", { status: 200 });
    });

    const html = await fetchFlightsHtml(input, {
      fetch: fetchImpl,
      retry: { attempts: 3, baseDelayMs: 1, maxDelayMs: 1 }
    });

    expect(html).toContain("ok");
    expect(calls).toBe(3);
  });

  it("returns RateLimitError instances for 429s", async () => {
    const fetchImpl = makeFetch(async () => new Response("nope", { status: 429, statusText: "Too Many Requests" }));

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("does not retry on 4xx other than 429", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      return new Response("bad", { status: 400, statusText: "Bad Request" });
    });

    await expect(
      fetchFlightsHtml(input, { fetch: fetchImpl, retry: { attempts: 3, baseDelayMs: 1 } })
    ).rejects.toMatchObject({ name: "HttpError", status: 400 });
    expect(calls).toBe(1);
  });

  it("caps total wall time with timeoutMs even across retry attempts", async () => {
    let calls = 0;
    const fetchImpl = makeFetch((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        calls++;
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      })
    );

    const started = Date.now();
    await expect(
      fetchFlightsHtml(input, {
        fetch: fetchImpl,
        timeoutMs: 50,
        retry: { attempts: 5, baseDelayMs: 1, maxDelayMs: 1 }
      })
    ).rejects.toBeInstanceOf(TimeoutError);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(500);
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("gives up after the max attempts and throws the last error", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      return new Response("nope", { status: 503, statusText: "Service Unavailable" });
    });

    await expect(
      fetchFlightsHtml(input, { fetch: fetchImpl, retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 1 } })
    ).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(3);
  });

  it("wraps aborts during retry backoff as FetchFlightsError", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      return new Response("nope", { status: 503, statusText: "Service Unavailable" });
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("user cancelled")), 5);

    await expect(
      fetchFlightsHtml(input, {
        fetch: fetchImpl,
        signal: controller.signal,
        retry: { attempts: 3, baseDelayMs: 50, maxDelayMs: 50 }
      })
    ).rejects.toBeInstanceOf(FetchFlightsError);
    expect(calls).toBe(1);
  });

  it("can fetch via RPC transport for structured queries", async () => {
    let observedUrl = "";
    let observedBody = "";
    const fetchImpl = makeFetch(async (url, init) => {
      observedUrl = String(url);
      observedBody = String(init?.body ?? "");
      return new Response(makeRpcEnvelope(), { status: 200 });
    });

    const result = await fetchFlights(structuredInput, {
      fetch: fetchImpl,
      transport: "rpc",
      cache: false
    });

    expect(observedUrl).toContain("GetShoppingResults");
    expect(observedUrl).toContain("hl=en-US");
    expect(observedUrl).toContain("curr=USD");
    expect(observedUrl).toContain("gl=MY");
    expect(observedBody).toContain("f.req=");
    expect(result.flights[0]?.bookingToken).toBe("rpc-token");
  });

  it("can fetch raw RPC text", async () => {
    const fetchImpl = makeFetch(async () => new Response(")]}'\n[[null,null,\"[]\"]]", { status: 200 }));
    const text = await fetchFlightsRpcText(structuredInput, {
      fetch: fetchImpl,
      cache: false
    });
    expect(text).toContain("[[null,null");
  });

  it("falls back to RPC in auto mode when HTML parsing fails", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async (url) => {
      calls++;
      if (String(url).includes("GetShoppingResults")) {
        return new Response(makeRpcEnvelope(), { status: 200 });
      }
      return new Response("<html><body>not flights</body></html>", { status: 200 });
    });

    const result = await fetchFlights(structuredInput, {
      fetch: fetchImpl,
      transport: "auto",
      cache: false
    });

    expect(calls).toBe(2);
    expect(result.flights[0]?.bookingToken).toBe("rpc-token");
  });

  it("dedupes repeated fetches through the session cache", async () => {
    clearSessionCache();
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      return new Response("<html><body>no scripts</body></html>", { status: 200 });
    });

    const promise1 = fetchFlights("Flights from KUL to NRT on 2026-05-10", {
      fetch: fetchImpl,
      cache: true,
      transport: "html"
    }).catch(() => null);
    const promise2 = fetchFlights("Flights from KUL to NRT on 2026-05-10", {
      fetch: fetchImpl,
      cache: true,
      transport: "html"
    }).catch(() => null);

    await Promise.all([promise1, promise2]);
    expect(calls).toBe(1);
    clearSessionCache();
  });

  it("emits telemetry callbacks", async () => {
    const requests: string[] = [];
    const responses: number[] = [];
    const parseErrors: string[] = [];
    const fetchImpl = makeFetch(async () => new Response("<html><body>not flights</body></html>", { status: 200 }));

    await expect(
      fetchFlights("Flights from KUL to NRT on 2026-05-10", {
        fetch: fetchImpl,
        cache: false,
        onRequest: (event) => requests.push(`${event.transport}:${event.url}`),
        onResponse: (event) => responses.push(event.status),
        onParseError: (event) => parseErrors.push(event.transport)
      })
    ).rejects.toBeDefined();

    expect(requests).toHaveLength(1);
    expect(responses).toEqual([200]);
    expect(parseErrors).toEqual(["html"]);
  });

  it("post-filters results by departure time", async () => {
    const fetchImpl = makeFetch(async () => new Response(OK_HTML, { status: 200 }));

    const result = await fetchFlights({
      flights: [{ date: "2026-05-10", fromAirport: "KUL", toAirport: "NRT" }],
      filters: {
        departureTime: { earliest: "23:59" }
      }
    }, {
      fetch: fetchImpl,
      cache: false
    });

    expect(result.flights).toHaveLength(0);
  });
});
