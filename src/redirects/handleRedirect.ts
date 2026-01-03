import type {
  FetchClientConfig,
  RequestContext,
  RedirectContext,
  RedirectMeta,
} from "../types.js";

async function handleRedirect(
  res: Response,
  ctx: RequestContext,
  redirects?: FetchClientConfig["redirects"]
): Promise<RedirectMeta> {
  if (res.status < 300 || res.status >= 400) {
    return { redirected: false };
  }

  const location = res.headers.get("location");
  if (!location) return { redirected: false };

  const rctx: RedirectContext = {
    location,
    status: res.status,
    ctx,
  };

  // Client-side / observational hook
  if (!ctx.isServer && redirects?.onClientRedirect) {
    await redirects?.onClientRedirect?.(rctx);
  }

  // Server-side / authoritative hook
  if (ctx.isServer && redirects?.onServerRedirect) {
    await redirects.onServerRedirect(rctx);

    // Must terminate
    throw new Error(
      `onServerRedirect did not terminate for redirect to ${location}`
    );
  }

  // Return redirect metadata to be attached to the safe response
  return {
    redirected: true,
    location,
    status: res.status,
  };
}

export { handleRedirect };
