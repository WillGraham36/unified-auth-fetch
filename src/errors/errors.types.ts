import { RequestContext, StandardError } from "../types";

export type ErrorStrategy = "throw" | "return";

export interface ErrorContext {
  status: number;
  statusText: string;
  message: string;
  parsedBody: unknown;
  raw: Response;
  url: string;
  method: string;
}

export interface ErrorConfig {
  handleClientError?(error: StandardError): unknown;
  handleServerError?(error: StandardError, ctx: RequestContext): unknown;
}

export class FetchError extends Error {
  response: Response;
  constructor(response: Response, message?: string) {
    super(message ?? `HTTP ${response.status}: ${response.statusText}`);
    this.response = response;
  }
}
