import { fetchFlights, type FetchFlightsOptions } from "./fetch.js";
import type { StructuredQueryInput } from "./query.js";
import type { FlightsSearchResult } from "./parse.js";

export interface SweepEntry {
  input: StructuredQueryInput;
  result?: FlightsSearchResult;
  error?: Error;
  startedAt: number;
  finishedAt: number;
}

export interface SweepOptions extends FetchFlightsOptions {
  /** Max in-flight queries. Defaults to 3. */
  concurrency?: number;
  /** Minimum delay between consecutive query starts across all workers, in ms. Defaults to 0. */
  minDelayMs?: number;
  /** Called as each query settles. */
  onResult?: (entry: SweepEntry, index: number) => void;
}

export async function sweepFlights(
  queries: StructuredQueryInput[],
  options: SweepOptions = {}
): Promise<SweepEntry[]> {
  if (queries.length === 0) return [];

  const concurrency = Math.max(1, options.concurrency ?? 3);
  const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
  const results: SweepEntry[] = new Array(queries.length);
  let cursor = 0;
  let nextSlot = Date.now();

  const reserveSlot = async (): Promise<number> => {
    if (minDelayMs <= 0) return Date.now();
    // Atomic reserve (no await between read and write) — workers can't race.
    const now = Date.now();
    const myStart = Math.max(now, nextSlot);
    nextSlot = myStart + minDelayMs;
    const wait = myStart - now;
    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
    return myStart;
  };

  const worker = async (): Promise<void> => {
    while (true) {
      if (options.signal?.aborted) return;
      const index = cursor++;
      if (index >= queries.length) return;

      const startedAt = await reserveSlot();
      if (options.signal?.aborted) return;

      const input = queries[index]!;
      const entry: SweepEntry = { input, startedAt, finishedAt: 0 };
      try {
        entry.result = await fetchFlights(input, options);
      } catch (error) {
        entry.error = error as Error;
      }
      entry.finishedAt = Date.now();
      results[index] = entry;
      options.onResult?.(entry, index);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, queries.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
