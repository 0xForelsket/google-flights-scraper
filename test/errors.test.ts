import { describe, expect, it } from "vitest";

import {
  CaptchaError,
  FetchFlightsError,
  HttpError,
  ParseFlightsError,
  QueryValidationError,
  RateLimitError,
  TimeoutError
} from "../src/errors.js";
import { parseFlightsHtml } from "../src/parse.js";

describe("error classes", () => {
  it("preserves cause on QueryValidationError", () => {
    const original = new Error("upstream");
    const wrapped = new QueryValidationError("bad input", { cause: original });
    expect(wrapped.cause).toBe(original);
    expect(wrapped.name).toBe("QueryValidationError");
  });

  it("exposes status on FetchFlightsError", () => {
    const err = new FetchFlightsError("nope", { status: 503 });
    expect(err.status).toBe(503);
    expect(err.name).toBe("FetchFlightsError");
  });

  it("has no status when omitted", () => {
    const err = new FetchFlightsError("nope");
    expect(err.status).toBeUndefined();
  });

  it("exposes distinct subtype names", () => {
    expect(new HttpError("bad gateway", { status: 502 }).name).toBe("HttpError");
    expect(new RateLimitError("slow down").name).toBe("RateLimitError");
    expect(new TimeoutError("timed out").name).toBe("TimeoutError");
    expect(new CaptchaError("challenge").name).toBe("CaptchaError");
  });
});

describe("parseFlightsHtml error paths", () => {
  it("throws ParseFlightsError when the ds:1 marker is missing", () => {
    expect(() => parseFlightsHtml("<html><body>no scripts</body></html>")).toThrow(ParseFlightsError);
  });

  it("throws CaptchaError for anti-bot pages", () => {
    const html = "<html><body><title>Sorry</title><p>Our systems have detected unusual traffic from your computer network.</p></body></html>";
    expect(() => parseFlightsHtml(html)).toThrow(CaptchaError);
  });

  it("throws ParseFlightsError with cause when the script fails to evaluate", () => {
    const html = `<html><body><script>AF_initDataCallback({key: 'ds:1', data: (function(){ throw new Error("boom"); })() });</script></body></html>`;
    try {
      parseFlightsHtml(html);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ParseFlightsError);
      expect((error as ParseFlightsError).cause).toBeDefined();
    }
  });
});
