export class QueryValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QueryValidationError";
  }
}

export class FetchFlightsError extends Error {
  readonly status?: number;

  constructor(message: string, options?: ErrorOptions & { status?: number }) {
    super(message, options);
    this.name = "FetchFlightsError";
    if (options?.status !== undefined) {
      this.status = options.status;
    }
  }
}

export class ParseFlightsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ParseFlightsError";
  }
}
