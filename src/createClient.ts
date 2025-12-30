import { handleError } from "./errors";
import { handleRedirect } from "./redirects";
import type {
  FetchClient,
  FetchClientConfig,
  RequestOptions,
  StandardResponse,
  RequestContext,
} from "./types";
import {
  isServer,
  buildUrl,
  mergeHeaders,
  parseResponse,
  createStandardShaper,
} from "./utils";

// ============================================================================
// Create Fetch Client Factory
// ============================================================================

export function createFetchClient(config: FetchClientConfig = {}): FetchClient {
  const {
    baseUrl,
    headers: globalHeaders,
    redirects,
    auth,
    errors: handlers,
  } = config;

  const shaper = config.responseFormat ?? createStandardShaper();

  // --------------------------------------------------------------------------
  // Core Executor
  // --------------------------------------------------------------------------
  async function execute<T>(
    path: string,
    options: RequestOptions & { method: string },
    safe: false
  ): Promise<T>;
  async function execute<T>(
    path: string,
    options: RequestOptions & { method: string },
    safe: true
  ): Promise<StandardResponse<T>>;
  async function execute<T>(
    path: string,
    options: RequestOptions & { method: string },
    safe: boolean
  ): Promise<T | StandardResponse<T>> {
    const {
      method,
      body,
      params,
      headers,
      onError,
      onRedirect,
      schema,
      disableAuth,
      ...rest
    } = options;

    const url = buildUrl(baseUrl, path, params);

    const mergedHeaders = mergeHeaders(globalHeaders, headers);
    if (body && !mergedHeaders.has("content-type")) {
      mergedHeaders.set("content-type", "application/json");
    }

    const redirectMode: RequestRedirect =
      isServer() && redirects?.serverRedirectHandler ? "manual" : "follow";

    const reqContext: RequestContext = {
      isServer: isServer(),
      url,
      method,
      headers: mergedHeaders,
      request: new Request(url),
    };

    const res = await fetch(url, {
      ...rest,
      method,
      headers: mergedHeaders,
      body: body ? JSON.stringify(body) : undefined,
      redirect: redirectMode,
      credentials:
        !isServer() && !disableAuth ? auth?.client?.credentials : undefined,
    });

    // --------------------------------------------------------------------------
    // Redirects
    // --------------------------------------------------------------------------
    await handleRedirect(res, reqContext, redirects, onRedirect);

    // --------------------------------------------------------------------------
    // Parse Response
    // --------------------------------------------------------------------------
    const parsed = await parseResponse(res);

    // --------------------------------------------------------------------------
    // Error handling
    // --------------------------------------------------------------------------
    if (!res.ok) {
      return handleError<T>(
        res,
        parsed,
        safe,
        reqContext,
        shaper,
        handlers,
        onError
      );
    }

    // --------------------------------------------------------------------------
    // Success
    // --------------------------------------------------------------------------
    let data = parsed as T;
    if (schema) {
      data = schema.parse(data) as T;
    }

    if (safe) {
      return shaper.success({ data, response: res }) as StandardResponse<T>;
    }

    return data;
  }

  // --------------------------------------------------------------------------
  // Public client
  // --------------------------------------------------------------------------
  return {
    get: (p, o = {}) => execute(p, { ...o, method: "GET" }, false),
    post: (p, o = {}) => execute(p, { ...o, method: "POST" }, false),
    put: (p, o = {}) => execute(p, { ...o, method: "PUT" }, false),
    patch: (p, o = {}) => execute(p, { ...o, method: "PATCH" }, false),
    delete: (p, o = {}) => execute(p, { ...o, method: "DELETE" }, false),

    safeGet: (p, o = {}) => execute(p, { ...o, method: "GET" }, true),
    safePost: (p, o = {}) => execute(p, { ...o, method: "POST" }, true),
    safePut: (p, o = {}) => execute(p, { ...o, method: "PUT" }, true),
    safePatch: (p, o = {}) => execute(p, { ...o, method: "PATCH" }, true),
    safeDelete: (p, o = {}) => execute(p, { ...o, method: "DELETE" }, true),

    request: (p, o) => execute(p, o, false),
  };
}
