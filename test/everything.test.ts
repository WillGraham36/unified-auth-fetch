import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFetchClient } from "../src/createClient";

// ============================================================================
// Mocks & Helpers
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

function setServerEnv(isServer: boolean) {
  if (isServer) {
    // @ts-ignore
    delete global.window;
  } else {
    // @ts-ignore
    global.window = {};
  }
}

function mockResponse(body: any, init: ResponseInit = {}) {
  const isJson = typeof body !== "string";
  const headers = new Headers(init.headers);
  if (isJson && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(isJson ? JSON.stringify(body) : body, {
    ...init,
    headers,
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe("createFetchClient (Standard Methods)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setServerEnv(true); // Default to Node/Server environment for tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. URL Building & HTTP Methods
  // --------------------------------------------------------------------------
  describe("Request Construction", () => {
    const client = createFetchClient({ baseUrl: "https://api.example.com" });

    it("constructs correct URLs with baseUrl", async () => {
      mockFetch.mockResolvedValue(mockResponse({ success: true }));

      await client.get("/users");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("handles absolute URLs ignoring baseUrl", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("https://other-domain.com/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://other-domain.com/test",
        expect.anything()
      );
    });

    it("serializes query parameters correctly", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.get("/search", {
        params: { q: "foo", page: 1, active: true, nullVal: null },
      });

      // Should exclude null/undefined, include others
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/search?q=foo&page=1&active=true",
        expect.anything()
      );
    });

    it("supports all standard HTTP methods", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.post("/1", { body: { a: 1 } });
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/1"),
        expect.objectContaining({ method: "POST" })
      );

      await client.put("/2");
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/2"),
        expect.objectContaining({ method: "PUT" })
      );

      await client.patch("/3");
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/3"),
        expect.objectContaining({ method: "PATCH" })
      );

      await client.delete("/4");
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/4"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. Headers & Body Handling
  // --------------------------------------------------------------------------
  describe("Headers & Content-Type", () => {
    it("merges global headers with request headers", async () => {
      const client = createFetchClient({
        headers: { "x-global": "1" },
      });
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.get("/test", { headers: { "x-local": "2" } });

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(calledHeaders.get("x-global")).toBe("1");
      expect(calledHeaders.get("x-local")).toBe("2");
    });

    it("automatically sets application/json when body is present", async () => {
      const client = createFetchClient();
      mockFetch.mockResolvedValue(mockResponse({}));

      const body = { name: "Test" };
      await client.post("/test", { body });

      const args = mockFetch.mock.calls[0][1];
      expect(args.body).toBe(JSON.stringify(body));
      expect((args.headers as Headers).get("content-type")).toBe(
        "application/json"
      );
    });

    it("respects manually provided content-type", async () => {
      const client = createFetchClient();
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.post("/test", {
        body: { name: "Test" },
        headers: { "content-type": "application/vnd.custom+json" },
      });

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get("content-type")).toBe("application/vnd.custom+json");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Auth & Cookies (Environment Specific)
  // --------------------------------------------------------------------------
  describe("Authentication Configuration", () => {
    it("passes auth credentials in Browser environment", async () => {
      setServerEnv(false); // Browser mode
      const client = createFetchClient({
        auth: {
          client: { credentials: "include" },
        },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/me");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("does NOT pass credentials in Server environment", async () => {
      setServerEnv(true); // Server mode
      const client = createFetchClient({
        auth: {
          client: { credentials: "include" },
        },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/me");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credentials: undefined })
      );
    });

    it("allows disabling auth per-request", async () => {
      setServerEnv(false);
      const client = createFetchClient({
        auth: { client: { credentials: "include" } },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/public", { disableAuth: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ credentials: undefined })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Response Parsing & Schemas
  // --------------------------------------------------------------------------
  describe("Response Handling", () => {
    const client = createFetchClient();

    it("parses JSON responses automatically", async () => {
      const data = { id: 123 };
      mockFetch.mockResolvedValue(mockResponse(data));

      const result = await client.get("/json");
      expect(result).toEqual(data);
    });

    it("falls back to text for non-JSON content types", async () => {
      mockFetch.mockResolvedValue(
        new Response("some text", { headers: { "content-type": "text/plain" } })
      );

      const result = await client.get("/text");
      expect(result).toBe("some text");
    });

    it("validates and transforms data using a schema", async () => {
      mockFetch.mockResolvedValue(mockResponse({ raw: "100" }));

      // Mock Zod-like schema
      const schema = {
        parse: vi.fn((d: any) => ({ ...d, parsed: Number(d.raw) })),
      };

      const result = await client.get("/schema", { schema });

      expect(schema.parse).toHaveBeenCalledWith({ raw: "100" });
      expect(result).toEqual({ raw: "100", parsed: 100 });
    });
  });

  // --------------------------------------------------------------------------
  // 5. Error Handling
  // --------------------------------------------------------------------------
  describe("Error Handling", () => {
    it("throws a StandardError object on 4xx/5xx responses", async () => {
      const client = createFetchClient();
      mockFetch.mockResolvedValue(
        mockResponse(
          { error: "Bad Request" },
          { status: 400, statusText: "Bad Request" }
        )
      );

      await expect(client.get("/fail")).rejects.toMatchObject({
        ok: false,
        status: 400,
        message: "HTTP 400: Bad Request",
        data: { error: "Bad Request" },
      });
    });

    it("calls global error handlers (Client)", async () => {
      setServerEnv(false);
      const clientHandler = vi.fn();

      const client = createFetchClient({
        errors: { handlers: { client: clientHandler } },
      });

      mockFetch.mockResolvedValue(mockResponse({}, { status: 500 }));

      try {
        await client.get("/500");
      } catch (e) {}

      expect(clientHandler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, ok: false })
      );
    });

    it("calls global error handlers (Server with Context)", async () => {
      setServerEnv(true);
      const serverHandler = vi.fn();

      const client = createFetchClient({
        errors: { handlers: { server: serverHandler } },
      });

      mockFetch.mockResolvedValue(mockResponse({}, { status: 500 }));

      try {
        await client.get("/500");
      } catch (e) {}

      expect(serverHandler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500 }),
        expect.objectContaining({
          isServer: true,
          url: expect.stringContaining("/500"),
        })
      );
    });

    it("allows request-level onError to recover/override the error", async () => {
      const client = createFetchClient();
      mockFetch.mockResolvedValue(mockResponse({}, { status: 404 }));

      const result = await client.get("/missing", {
        onError: (err) => {
          return { fallback: "value" }; // Return fallback
        },
      });

      expect(result).toEqual({ fallback: "value" });
    });

    it("uses a custom response shaper for errors", async () => {
      const client = createFetchClient({
        errors: {
          shaper: {
            success: (ctx) => ctx.data,
            error: (ctx) => ({
              ok: false,
              status: ctx.status,
              message: "Custom Error Message", // Customized
              raw: ctx.raw,
            }),
          },
        },
      });

      mockFetch.mockResolvedValue(mockResponse({}, { status: 500 }));

      await expect(client.get("/fail")).rejects.toMatchObject({
        message: "Custom Error Message",
      });
    });
  });

  // --------------------------------------------------------------------------
  // 6. Redirects
  // --------------------------------------------------------------------------
  describe("Redirect Handling", () => {
    it("calls observational hooks on redirect", async () => {
      const globalSideEffect = vi.fn();
      const requestSideEffect = vi.fn();

      const client = createFetchClient({
        redirects: { onRedirectSideEffect: globalSideEffect },
      });

      mockFetch.mockResolvedValue(
        mockResponse({}, { status: 302, headers: { location: "/new-place" } })
      );

      await client.get("/old-place", { onRedirect: requestSideEffect });

      const expectedCtx = expect.objectContaining({
        location: "/new-place",
        status: 302,
      });

      expect(globalSideEffect).toHaveBeenCalledWith(expectedCtx);
      expect(requestSideEffect).toHaveBeenCalledWith(expectedCtx);
    });

    it("handles Server-Side manual redirects", async () => {
      setServerEnv(true);
      const serverHandler = vi.fn();

      const client = createFetchClient({
        redirects: { serverRedirectHandler: serverHandler },
      });

      // 1. Mock the fetch to return a 302
      mockFetch.mockResolvedValue(
        mockResponse({}, { status: 302, headers: { location: "/login" } })
      );

      // 2. Expect the execute function to THROW (preventing silent continuation)
      // because the serverHandler in this test doesn't throw/terminate itself.
      await expect(client.get("/protected")).rejects.toThrow(
        "serverRedirectHandler did not terminate"
      );

      // 3. Check that fetch was called with redirect: "manual"
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ redirect: "manual" })
      );

      // 4. Check handler was called
      expect(serverHandler).toHaveBeenCalledWith(
        expect.objectContaining({ location: "/login" })
      );
    });

    it("uses standard follow mode on Client even if redirects configured", async () => {
      setServerEnv(false);
      const client = createFetchClient({
        redirects: { serverRedirectHandler: vi.fn() },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/test");

      // Browser should always be "follow", ignoring server handler config
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ redirect: "follow" })
      );
    });
  });
});
