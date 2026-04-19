import { fetchFlights } from "./fetch.js";
export async function sweepFlights(queries, options = {}) {
    if (queries.length === 0)
        return [];
    const concurrency = Math.max(1, options.concurrency ?? 3);
    const minDelayMs = Math.max(0, options.minDelayMs ?? 0);
    const results = new Array(queries.length);
    let cursor = 0;
    let lastStart = 0;
    const worker = async () => {
        while (true) {
            if (options.signal?.aborted)
                return;
            const index = cursor++;
            if (index >= queries.length)
                return;
            if (minDelayMs > 0) {
                const wait = lastStart + minDelayMs - Date.now();
                if (wait > 0) {
                    await new Promise((resolve) => setTimeout(resolve, wait));
                }
            }
            lastStart = Date.now();
            const input = queries[index];
            const startedAt = Date.now();
            const entry = { input, startedAt, finishedAt: 0 };
            try {
                entry.result = await fetchFlights(input, options);
            }
            catch (error) {
                entry.error = error;
            }
            entry.finishedAt = Date.now();
            results[index] = entry;
            options.onResult?.(entry, index);
        }
    };
    const workers = Array.from({ length: Math.min(concurrency, queries.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
//# sourceMappingURL=sweep.js.map