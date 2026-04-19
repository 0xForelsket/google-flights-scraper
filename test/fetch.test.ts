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
});
