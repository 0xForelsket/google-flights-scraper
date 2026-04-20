export class QueryValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QueryValidationError";
  }
}

export class FetchFlightsError extends Error {
  readonly status?: number;
  readonly statusText?: string;
  readonly url?: string;

  constructor(message: string, options?: ErrorOptions & {
    status?: number;
    statusText?: string;
    url?: string;
  }) {
    super(message, options);
    this.name = "FetchFlightsError";
    if (options?.status !== undefined) {
      this.status = options.status;
    }
    if (options?.statusText !== undefined) {
      this.statusText = options.statusText;
    }
    if (options?.url !== undefined) {
      this.url = options.url;
    }
  }
}

export class HttpError extends FetchFlightsError {
  constructor(message: string, options: ErrorOptions & { status: number; statusText?: string; url?: string }) {
    super(message, options);
    this.name = "HttpError";
  }
}

export class RateLimitError extends HttpError {
  constructor(message: string, options: ErrorOptions & { status?: number; statusText?: string; url?: string } = { status: 429 }) {
    super(message, { ...options, status: options.status ?? 429 });
    this.name = "RateLimitError";
  }
}

export class TimeoutError extends FetchFlightsError {
  constructor(message: string, options?: ErrorOptions & { url?: string }) {
    super(message, options);
    this.name = "TimeoutError";
  }
}

export class ParseFlightsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ParseFlightsError";
  }
}

export class CaptchaError extends ParseFlightsError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CaptchaError";
  }
}
