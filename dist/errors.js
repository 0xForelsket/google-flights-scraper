export class QueryValidationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "QueryValidationError";
    }
}
export class FetchFlightsError extends Error {
    status;
    constructor(message, options) {
        super(message, options);
        this.name = "FetchFlightsError";
        if (options?.status !== undefined) {
            this.status = options.status;
        }
    }
}
export class ParseFlightsError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "ParseFlightsError";
    }
}
//# sourceMappingURL=errors.js.map