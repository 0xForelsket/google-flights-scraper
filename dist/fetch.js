import { FetchFlightsError, HttpError, RateLimitError, TimeoutError } from "./errors.js";
import { buildSearchUrl } from "./query.js";
import { parseFlightsHtml } from "./parse.js";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};
function errorName(value) {
    if (typeof value !== "object" || value === null || !("name" in value)) {
        return undefined;
    }
    const name = value.name;
    return typeof name === "string" ? name : undefined;
}
function isTimeoutLike(value) {
    return errorName(value) === "TimeoutError";
}
function abortToFetchError(signal, cause, url) {
    if (isTimeoutLike(cause) || isTimeoutLike(signal?.reason)) {
        return new TimeoutError("Google Flights request timed out.", {
            cause,
            ...(url === undefined ? {} : { url })
        });
    }
    return new FetchFlightsError("Google Flights request was aborted.", {
        cause,
        ...(url === undefined ? {} : { url })
    });
}
function resolveFetch(fetchImpl) {
    if (fetchImpl) {
        return fetchImpl;
    }
    if (typeof globalThis.fetch !== "function") {
        throw new FetchFlightsError("No fetch implementation is available. Provide one through options.fetch.");
    }
    return globalThis.fetch.bind(globalThis);
}
function buildHeaders(options) {
    if (options.replaceHeaders) {
        return options.headers ?? {};
    }
    return { ...DEFAULT_HEADERS, ...options.headers };
}
function combineSignals(user, timeoutMs) {
    if (timeoutMs <= 0) {
        return user;
    }
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    if (!user) {
        return timeoutSignal;
    }
    const controller = new AbortController();
    const onAbort = (reason) => controller.abort(reason);
    if (user.aborted)
        controller.abort(user.reason);
    else
        user.addEventListener("abort", () => onAbort(user.reason), { once: true });
    if (timeoutSignal.aborted)
        controller.abort(timeoutSignal.reason);
    else
        timeoutSignal.addEventListener("abort", () => onAbort(timeoutSignal.reason), { once: true });
    return controller.signal;
}
function defaultShouldRetry(error) {
    if (error.status === undefined)
        return true;
    return error.status === 429 || (error.status >= 500 && error.status < 600);
}
async function sleep(ms, signal) {
    if (ms <= 0)
        return;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (!signal)
            return;
        if (signal.aborted) {
            clearTimeout(timer);
            reject(signal.reason);
            return;
        }
        signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason);
        }, { once: true });
    });
}
async function runWithRetry(fn, retry, signal) {
    const attempts = Math.max(0, retry?.attempts ?? 0);
    const baseDelayMs = Math.max(0, retry?.baseDelayMs ?? 500);
    const maxDelayMs = Math.max(baseDelayMs, retry?.maxDelayMs ?? 10_000);
    const shouldRetry = retry?.shouldRetry ?? defaultShouldRetry;
    let lastError;
    for (let attempt = 0; attempt <= attempts; attempt++) {
        try {
            return await fn(attempt);
        }
        catch (error) {
            if (!(error instanceof FetchFlightsError))
                throw error;
            lastError = error;
            if (attempt === attempts)
                break;
            if (signal?.aborted)
                break;
            if (!shouldRetry(error, attempt + 1))
                break;
            const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
            const jitter = Math.random() * baseDelayMs;
            try {
                await sleep(backoff + jitter, signal);
            }
            catch (sleepError) {
                throw abortToFetchError(signal, sleepError);
            }
        }
    }
    throw lastError;
}
async function attemptFetchHtml(url, options, signal) {
    const fetchImpl = resolveFetch(options.fetch);
    const init = { headers: buildHeaders(options) };
    if (signal)
        init.signal = signal;
    let response;
    try {
        response = await fetchImpl(url, init);
    }
    catch (error) {
        if (signal?.aborted || isTimeoutLike(error)) {
            throw abortToFetchError(signal, error, url);
        }
        throw new FetchFlightsError(`Failed to reach Google Flights: ${error.message ?? String(error)}`, { cause: error, url });
    }
    if (!response.ok) {
        const message = `Google Flights returned ${response.status} ${response.statusText}.`;
        if (response.status === 429) {
            throw new RateLimitError(message, {
                status: response.status,
                statusText: response.statusText,
                url: response.url || url
            });
        }
        throw new HttpError(message, {
            status: response.status,
            statusText: response.statusText,
            url: response.url || url
        });
    }
    const html = await response.text();
    if (html.length === 0) {
        throw new FetchFlightsError("Google Flights returned an empty HTML response.", {
            status: response.status,
            statusText: response.statusText,
            url: response.url || url
        });
    }
    return html;
}
export async function fetchFlightsHtml(input, options = {}) {
    const url = buildSearchUrl(input);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const totalSignal = combineSignals(options.signal, timeoutMs);
    return runWithRetry(() => attemptFetchHtml(url, options, totalSignal), options.retry, totalSignal);
}
export async function fetchFlights(input, options = {}) {
    const html = await fetchFlightsHtml(input, options);
    return parseFlightsHtml(html);
}
//# sourceMappingURL=fetch.js.map