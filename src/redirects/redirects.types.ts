import { RequestContext } from "../types";

export interface RedirectContext {
  location: string;
  status: number;
  ctx: RequestContext;
}

export interface RedirectConfig {
  /**
   * Observational only
   * Called when a redirect response is encountered
   * Does NOT control navigation
   */
  onRedirectSideEffect?(ctx: RedirectContext): void | Promise<void>;

  /**
   * Server-only
   * Enables manual redirect handling
   * If provided, fetch will use redirect: "manual"
   * Intended to be overwritten for each framework and not visible to general users
   */
  serverRedirectHandler?(ctx: RedirectContext): void | Promise<void>;
}
