import { type FetchFlightsOptions } from "./fetch.js";
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
export declare function sweepFlights(queries: StructuredQueryInput[], options?: SweepOptions): Promise<SweepEntry[]>;
//# sourceMappingURL=sweep.d.ts.map