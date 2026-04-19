export declare class QueryValidationError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class FetchFlightsError extends Error {
    readonly status?: number;
    constructor(message: string, options?: ErrorOptions & {
        status?: number;
    });
}
export declare class ParseFlightsError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
//# sourceMappingURL=errors.d.ts.map