import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFetchClient } from "../src/createClient";
import { FetchError } from "../src/types";

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

function lastRequest(): Request {
  return mockFetch.mock.calls.at(-1)![0] as Request;
}

// ============================================================================
// Test Suite
// ============================================================================

describe("createFetchClient (Standard Methods)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setServerEnv(true);
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

      const req = lastRequest();
      expect(req.method).toBe("GET");
      expect(req.url).toBe("https://api.example.com/users");
    });

    it("handles absolute URLs ignoring baseUrl", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.get("https://other-domain.com/test");

      const req = lastRequest();
      expect(req.method).toBe("GET");
      expect(req.url).toBe("https://other-domain.com/test");
    });

    it("serializes query parameters correctly", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.get("/search", {
        params: { q: "foo", page: 1, active: true, nullVal: null },
      });

      const req = lastRequest();
      expect(req.url).toBe(
        "https://api.example.com/search?q=foo&page=1&active=true"
      );
    });

    it("supports all standard HTTP methods", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      await client.post("/1", { body: { a: 1 } });
      expect(lastRequest().method).toBe("POST");

      await client.put("/2");
      expect(lastRequest().method).toBe("PUT");

      await client.patch("/3");
      expect(lastRequest().method).toBe("PATCH");

      await client.delete("/4");
      expect(lastRequest().method).toBe("DELETE");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Headers & Body Handling
  // --------------------------------------------------------------------------
  describe("Headers & Content-Type", () => {
    it("merges global headers with request headers", async () => {
      const client = createFetchClient({
        baseUrl: "https://example.com",
        headers: { "x-global": "1" },
      });

      mockFetch.mockResolvedValue(mockResponse({}));

      await client.get("/test", { headers: { "x-local": "2" } });

      const headers = lastRequest().headers;
      expect(headers.get("x-global")).toBe("1");
      expect(headers.get("x-local")).toBe("2");
    });

    it("automatically sets application/json when body is present", async () => {
      const client = createFetchClient({
        baseUrl: "https://example.com",
      });

      mockFetch.mockResolvedValue(mockResponse({}));

      const body = { name: "Test" };
      await client.post("/test", { body });

      const req = lastRequest();
      expect(req.headers.get("content-type")).toBe("application/json");
    });

    it("respects manually provided content-type", async () => {
      const client = createFetchClient({
        baseUrl: "https://example.com",
      });

      mockFetch.mockResolvedValue(mockResponse({}));

      await client.post("/test", {
        body: { name: "Test" },
        headers: { "content-type": "application/vnd.custom+json" },
      });

      const headers = lastRequest().headers;
      expect(headers.get("content-type")).toBe("application/vnd.custom+json");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Auth & Cookies (Environment Specific)
  // --------------------------------------------------------------------------
  describe("Authentication Configuration", () => {
    it("passes auth credentials in Browser environment", async () => {
      setServerEnv(false);

      const client = createFetchClient({
        baseUrl: "https://example.com",
        auth: {
          client: { credentials: "include" },
        },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/me");

      expect(lastRequest().credentials).toBe("include");
    });

    it("does NOT pass credentials in Server environment", async () => {
      setServerEnv(true);

      const client = createFetchClient({
        baseUrl: "https://example.com",
        auth: {
          client: { credentials: "include" },
        },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/me");

      expect(lastRequest().credentials).toBe("same-origin");
    });

    it("allows disabling auth per-request", async () => {
      setServerEnv(false);

      const client = createFetchClient({
        baseUrl: "https://example.com",
        auth: { client: { credentials: "include" } },
      });

      mockFetch.mockResolvedValue(mockResponse({}));
      await client.get("/public", { disableAuth: true });

      expect(lastRequest().credentials).toBe("same-origin");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Response Parsing & Schemas
  // --------------------------------------------------------------------------
  describe("Response Handling", () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
    });

    it("parses JSON responses automatically", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: 123 }));

      const result = await client.get("/json");
      expect(result).toEqual({ id: 123 });
    });

    it("falls back to text for non-JSON content types", async () => {
      mockFetch.mockResolvedValue(
        new Response("some text", {
          headers: { "content-type": "text/plain" },
        })
      );

      const result = await client.get("/text");
      expect(result).toBe("some text");
    });

    it("validates and transforms data using a schema", async () => {
      mockFetch.mockResolvedValue(mockResponse({ raw: "100" }));

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
      const client = createFetchClient({
        baseUrl: "https://httpstat.us",
      });

      mockFetch.mockResolvedValue(
        mockResponse(
          { error: "Bad Request" },
          { status: 400, statusText: "Bad Request" }
        )
      );

      await expect(client.get("/400")).rejects.toBeInstanceOf(Error);

      try {
        await client.get("/400");
      } catch (e) {
        expect((e as FetchError).response.status).toBe(400);
      }
    });

    it("allows request-level onError to recover/override the error", async () => {
      const client = createFetchClient({
        baseUrl: "https://httpstat.us",
      });

      mockFetch.mockResolvedValue(mockResponse({}, { status: 404 }));

      const result = await client.get("/404", {
        onError: () => ({ fallback: "value" }),
      });

      expect(result).toEqual({ fallback: "value" });
    });
  });

  // --------------------------------------------------------------------------
  // 6. Redirects
  // --------------------------------------------------------------------------
  describe("Redirect Handling", () => {
    it("calls client redirect side effects on redirect (client env)", async () => {
      setServerEnv(false);

      const onRedirect = vi.fn();

      const client = createFetchClient({
        baseUrl: "https://httpstat.us",
        redirects: { onClientRedirect: onRedirect },
      });

      mockFetch.mockResolvedValue(
        mockResponse(null, {
          status: 302,
          headers: { location: "/new-place" },
        })
      );

      await client.safeGet("/302");

      expect(onRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          location: "/new-place",
          status: 302,
        })
      );
    });

    it("calls server redirect handler and forces termination (server env)", async () => {
      setServerEnv(true);

      const onServerRedirect = vi.fn();

      const client = createFetchClient({
        baseUrl: "https://httpstat.us",
        redirects: { onServerRedirect },
      });

      mockFetch.mockResolvedValue(
        mockResponse(null, {
          status: 302,
          headers: { location: "/login" },
        })
      );

      await expect(client.get("/302")).rejects.toThrow(
        "onServerRedirect did not terminate"
      );

      expect(onServerRedirect).toHaveBeenCalled();
    });
  });
});
