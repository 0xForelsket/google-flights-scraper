export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}

export class FetchFlightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchFlightsError";
  }
}

export class ParseFlightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseFlightsError";
  }
}
