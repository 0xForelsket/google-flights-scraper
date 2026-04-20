export declare class QueryValidationError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class FetchFlightsError extends Error {
    readonly status?: number;
    readonly statusText?: string;
    readonly url?: string;
    constructor(message: string, options?: ErrorOptions & {
        status?: number;
        statusText?: string;
        url?: string;
    });
}
export declare class HttpError extends FetchFlightsError {
    constructor(message: string, options: ErrorOptions & {
        status: number;
        statusText?: string;
        url?: string;
    });
}
export declare class RateLimitError extends HttpError {
    constructor(message: string, options?: ErrorOptions & {
        status?: number;
        statusText?: string;
        url?: string;
    });
}
export declare class TimeoutError extends FetchFlightsError {
    constructor(message: string, options?: ErrorOptions & {
        url?: string;
    });
}
export declare class ParseFlightsError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class CaptchaError extends ParseFlightsError {
    constructor(message: string, options?: ErrorOptions);
}
//# sourceMappingURL=errors.d.ts.map