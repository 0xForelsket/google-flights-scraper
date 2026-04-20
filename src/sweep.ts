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

export class SweepRun implements AsyncIterable<SweepEntry>, PromiseLike<SweepEntry[]> {
  private readonly queue: SweepEntry[] = [];
  private readonly waiters: Array<(value: IteratorResult<SweepEntry>) => void> = [];
  private closed = false;
  private donePromise: Promise<SweepEntry[]> = Promise.resolve([]);

  setDonePromise(donePromise: Promise<SweepEntry[]>): void {
    this.donePromise = donePromise;
  }

  push(entry: SweepEntry): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: entry, done: false });
      return;
    }

    this.queue.push(entry);
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  then<TResult1 = SweepEntry[], TResult2 = never>(
    onfulfilled?: ((value: SweepEntry[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.donePromise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<SweepEntry[] | TResult> {
    return this.donePromise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<SweepEntry[]> {
    return this.donePromise.finally(onfinally);
  }

  [Symbol.asyncIterator](): AsyncIterator<SweepEntry> {
    return {
      next: () => {
        const queued = this.queue.shift();
        if (queued) {
          return Promise.resolve({ value: queued, done: false });
        }

        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }

        return new Promise<IteratorResult<SweepEntry>>((resolve) => {
          this.waiters.push(resolve);
        });
      }
    };
  }
}

export function sweepFlights(
  queries: StructuredQueryInput[],
  options: SweepOptions = {}
): SweepRun {
  const run = new SweepRun();
  run.setDonePromise((async () => {
    if (queries.length === 0) {
      run.close();
      return [];
    }

    const concurrency = Math.max(1, options.concurrency ?? 3);
    const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
    const results: SweepEntry[] = new Array(queries.length);
    let cursor = 0;
    let nextSlot = Date.now();

    const reserveSlot = async (): Promise<number> => {
      if (minDelayMs <= 0) return Date.now();
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
        run.push(entry);
        options.onResult?.(entry, index);
      }
    };

    try {
      const workers = Array.from(
        { length: Math.min(concurrency, queries.length) },
        () => worker()
      );
      await Promise.all(workers);
      return results;
    } finally {
      run.close();
    }
  })());

  return run;
}
