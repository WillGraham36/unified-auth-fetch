import type {
  FetchClientConfig,
  RequestContext,
  RedirectContext,
  RedirectResult,
} from "../types";

async function handleRedirect(
  res: Response,
  ctx: RequestContext,
  redirects?: FetchClientConfig["redirects"],
  onRedirect?: (rctx: RedirectContext) => Promise<void> | void
): Promise<RedirectResult> {
  if (res.status < 300 || res.status >= 400) return { handled: false };

  const location = res.headers.get("location");
  if (!location) return { handled: false };

  const rctx: RedirectContext = {
    location,
    status: res.status,
    ctx,
  };

  // Request-level hook (always observational)
  await onRedirect?.(rctx);

  // Global observational hook
  await redirects?.onRedirectSideEffect?.(rctx);

  // Server-only authoritative handler
  if (ctx.isServer && redirects?.serverRedirectHandler) {
    await redirects.serverRedirectHandler(rctx);

    // If the handler does not throw or terminate, prevent silent fallthrough
    throw new Error(
      `serverRedirectHandler did not terminate for redirect to ${location}`
    );
  }
  return { handled: true, location, status: res.status };
}

export { handleRedirect };
