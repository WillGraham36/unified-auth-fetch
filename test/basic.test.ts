import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFetchClient } from "../src/createClient";

describe("basic fetch client usage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a client and fetches JSON data", async () => {
    // Mock fetch with a dummy JSON API response
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ id: 1, name: "Test User" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as any;

    // Mock CookieReader
    const cookieStore = {
      get(name: string) {
        const cookies = { JSESSIONID: "abc123" } as Record<string, string>;
        const value = cookies[name];
        return value ? { value } : undefined;
      },
    };

    const api = createFetchClient({
      baseUrl: "https://example.com",
      cookies: cookieStore,
      auth: {
        server: {
          enabled: true,
          cookies({ cookieStore, url, method }) {
            return {
              JSESSIONID: cookieStore.get("JSESSIONID")?.value || "",
            };
          },
        },
        client: {
          enabled: true,
          credentials: "include",
        },
      },
      headers: {
        "X-Custom-Header": "CustomValue",
      },
      redirects: {
        onRedirectSideEffect(ctx) {
          console.log("Redirected to:", ctx.location);
        },
      },
      errors: {
        handleClientError(error) {
          console.error("Client error:", error);
        },
        handleServerError(error, ctx) {
          console.error("Server error:", error, "Context:", ctx);
        },
      },
      responseFormat: {
        success({ data, response }) {
          return {
            ok: true,
            status: response.status,
            data,
            headers: response.headers,
            raw: response,
          };
        },
        error(ctx) {
          return {
            ok: false,
            status: ctx.status,
            message: ctx.message,
            data: ctx.parsedBody,
            raw: ctx.raw,
          };
        },
      },
    });

    const result = await api.safeGet<{ id: number; name: string }>("/users/1");

    expect(result).toEqual({
      id: 1,
      name: "Test User",
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/users/1",
      expect.objectContaining({
        method: "GET",
      })
    );
  });
});
