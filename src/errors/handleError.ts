import type {
  StandardResponse,
  StandardError,
  ErrorContext,
  RequestContext,
  ResponseShaper,
  ErrorConfig,
} from "../types";

async function handleError<T>(
  res: Response,
  parsed: unknown,
  safe: boolean,
  ctx: RequestContext,
  shaper: ResponseShaper,
  handlers?: ErrorConfig,
  onError?: (error: StandardError) => unknown
): Promise<T | StandardResponse<T>> {
  const errorCtx: ErrorContext = {
    status: res.status,
    statusText: res.statusText,
    message: `HTTP ${res.status}: ${res.statusText}`,
    parsedBody: parsed,
    raw: res,
    url: ctx.url,
    method: ctx.method,
  };

  const shaped = shaper.error(errorCtx);

  if (ctx.isServer) {
    await handlers?.handleServerError?.(shaped, ctx);
  } else {
    await handlers?.handleClientError?.(shaped);
  }

  const override = onError?.(shaped);
  if (override !== undefined) return override as T;

  if (safe) return shaped;

  throw Object.assign(new Error(shaped.message), shaped);
}

export { handleError };
