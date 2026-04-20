import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { expandLocationCode, flightsSearchResultSchema, parseFlightsHtml } from "../src/index.js";

describe("extended metadata helpers", () => {
  it("validates parsed results with the exported zod schema", () => {
    const ds1Script = readFileSync(new URL("./fixtures/kul-nrt-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(flightsSearchResultSchema.parse(result)).toEqual(result);
  });

  it("expands a city or metro code to airport codes from parsed metadata", () => {
    const ds1Script = readFileSync(new URL("./fixtures/pen-sha-ds1.js", import.meta.url), "utf8");
    const html = `<html><body><script>${ds1Script}</script></body></html>`;
    const result = parseFlightsHtml(html);

    expect(expandLocationCode("SHA", result.metadata.locations)).toContain("SHA");
    expect(expandLocationCode("SHA", result.metadata.locations).length).toBeGreaterThan(0);
  });
});
