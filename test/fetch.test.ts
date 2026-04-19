import { describe, expect, it } from "vitest";

import { fetchFlightsHtml } from "../src/fetch.js";
import { FetchFlightsError } from "../src/errors.js";

function makeFetch(impl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) {
  return impl as typeof globalThis.fetch;
}

describe("fetchFlightsHtml", () => {
  const input = "Flights from KUL to NRT on 2026-05-10";

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
      name: "FetchFlightsError",
      status: 429
    });
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

    await expect(fetchFlightsHtml(input, { fetch: fetchImpl, timeoutMs: 10 })).rejects.toBeInstanceOf(FetchFlightsError);
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

  it("does not retry on 4xx other than 429", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(async () => {
      calls++;
      return new Response("bad", { status: 400, statusText: "Bad Request" });
    });

    await expect(
      fetchFlightsHtml(input, { fetch: fetchImpl, retry: { attempts: 3, baseDelayMs: 1 } })
    ).rejects.toMatchObject({ name: "FetchFlightsError", status: 400 });
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
    ).rejects.toBeInstanceOf(FetchFlightsError);
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
});
