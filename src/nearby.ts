import type { LocationMetadata } from "./parse.js";

export interface LocationIndexEntry {
  code: string;
  cityCode: string;
  cityName: string;
  airports: string[];
}

export function createLocationIndex(locations: LocationMetadata[]): Map<string, LocationIndexEntry> {
  const byCity = new Map<string, LocationIndexEntry>();

  for (const location of locations) {
    const key = location.cityCode || location.code;
    const existing = byCity.get(key) ?? {
      code: key,
      cityCode: location.cityCode || key,
      cityName: location.cityName || location.name,
      airports: []
    };

    if (location.kind === "airport" && !existing.airports.includes(location.code)) {
      existing.airports.push(location.code);
    }

    byCity.set(key, existing);
    byCity.set(location.code, existing);
  }

  return byCity;
}

export function expandLocationCode(
  code: string,
  locations: LocationMetadata[] | Map<string, LocationIndexEntry>
): string[] {
  const index = locations instanceof Map ? locations : createLocationIndex(locations);
  const normalizedCode = code.trim().toUpperCase();
  const entry = index.get(normalizedCode);

  if (!entry || entry.airports.length === 0) {
    return [normalizedCode];
  }

  return [...entry.airports];
}
