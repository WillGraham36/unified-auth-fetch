// ============================================================================
// Environment & Context Types
// ============================================================================

import { ErrorConfig, ErrorContext } from "./errors/errors.types";
import { RedirectConfig, RedirectContext } from "./redirects/redirects.types";

export interface RequestContext {
  isServer: boolean;
  url: string;
  method: string;
  headers: Headers;
  request: Request;
}

// ============================================================================
// Cookies
// ============================================================================

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface CookieContext {
  cookieStore: CookieReader;
  headers: Headers;
  request: Request;
}

// ============================================================================
// Auth Configuration
// ============================================================================

export interface ClientAuthConfig {
  enabled?: boolean;
  credentials?: RequestCredentials;
}

export interface ServerAuthConfig {
  enabled?: boolean;
  cookies?(ctx: {
    cookieStore: CookieReader;
    url: string;
    method: string;
  }): Record<string, string> | Promise<Record<string, string>>;
}

export interface AuthConfig {
  client?: ClientAuthConfig;
  server?: ServerAuthConfig;
}

// ============================================================================
// Response Shapes
// ============================================================================

export interface StandardSuccess<T> {
  ok: true;
  status: number;
  data: T;
  message?: string;
  headers: Headers;
  raw: Response;
}

export interface StandardError {
  ok: false;
  status: number;
  message: string;
  data?: unknown;
  raw: Response;
}

type StandardRedirect = {
  ok: false;
  redirected: true;
  status: number;
  location: string;
};

export type StandardResponse<T> =
  | StandardSuccess<T>
  | StandardError
  | StandardRedirect;

export interface ResponseShaper<TResponse = unknown> {
  success(ctx: { data: unknown; response: Response }): TResponse;
  error(ctx: ErrorContext): StandardError;
  redirect?(ctx: RedirectContext): StandardRedirect;
}

export interface FullResponseShaper<T> extends ResponseShaper<T> {
  redirect(ctx: RedirectContext): StandardRedirect;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface FetchClientConfig {
  baseUrl?: string;
  cookies?: CookieReader;
  auth?: AuthConfig;
  errors?: ErrorConfig;
  redirects?: RedirectConfig;
  headers?: HeadersInit;
  responseFormat?: ResponseShaper;
}

// ============================================================================
// Request Options
// ============================================================================

export interface RequestOptions<TBody = unknown>
  extends Omit<RequestInit, "method" | "body"> {
  body?: TBody;
  params?: Record<string, string | number | boolean | null | undefined>;
  disableAuth?: boolean;
  onError?(error: StandardError): unknown;
  onRedirect?(ctx: RedirectContext): void | Promise<void>;
  schema?: { parse(data: unknown): unknown };
  headers?: HeadersInit;
}

// ============================================================================
// Fetch Client Interface
// ============================================================================

export interface FetchClient {
  get<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<T>;
  post<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  patch<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<T>;

  safeGet<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<StandardResponse<T>>;
  safePost<T = unknown>(
    path: string,
    options?: RequestOptions
  ): Promise<StandardResponse<T>>;
  safePut<T = unknown>(
    path: string,
    options?: RequestOptions
  ): Promise<StandardResponse<T>>;
  safePatch<T = unknown>(
    path: string,
    options?: RequestOptions
  ): Promise<StandardResponse<T>>;
  safeDelete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<StandardResponse<T>>;

  request<T = unknown>(
    path: string,
    options: RequestOptions & { method: string }
  ): Promise<T>;
}

export * from "./errors/errors.types";
export * from "./redirects/redirects.types";
