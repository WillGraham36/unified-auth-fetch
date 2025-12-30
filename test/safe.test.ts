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

// --------------------------------------------------------------------------
// 7. Safe Methods
// --------------------------------------------------------------------------
describe("Safe Methods (safeGet, safePost, etc.)", () => {
  beforeEach(() => {
    setServerEnv(true);
  });

  it("returns a shaped success object for safeGet", async () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
      responseFormat: {
        success: (ctx) => ({ ok: true, status: 200, data: ctx.data }),
        error: (ctx) => ({
          ok: false,
          status: ctx.status,
          message: ctx.message,
          raw: ctx.raw,
        }),
      },
    });

    mockFetch.mockResolvedValue(mockResponse({ id: 1 }, { status: 200 }));

    const res = await client.safeGet("/success");

    expect(res).toMatchObject({
      ok: true,
      status: 200,
      data: { id: 1 },
    });
  });

  it("returns a shaped error object for safeGet on 4xx/5xx", async () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
      responseFormat: {
        success: (ctx) => ({ ok: true, status: 200, data: ctx.data }),
        error: (ctx) => ({
          ok: false,
          status: ctx.status,
          message: "Custom Error",
          customField: "customValue",
          raw: ctx.raw,
        }),
      },
    });

    mockFetch.mockResolvedValue(mockResponse({}, { status: 500 }));

    const res = await client.safeGet("/fail");

    expect(res).toMatchObject({
      ok: false,
      status: 500,
      message: "Custom Error",
    });
  });

  it("safePost returns shaped success object with body", async () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
      responseFormat: {
        success: (ctx) => ({ ok: true, status: 201, data: ctx.data }),
        error: (ctx) => ({
          ok: false,
          status: ctx.status,
          message: ctx.message,
          raw: ctx.raw,
        }),
      },
    });

    const body = { name: "Test" };
    mockFetch.mockResolvedValue(
      mockResponse({ id: 42, name: "Test" }, { status: 201 })
    );

    const res = await client.safePost("/create", { body });

    expect(res).toMatchObject({
      ok: true,
      status: 201,
      data: { id: 42, name: "Test" },
    });
  });

  it("safePost returns shaped error object on server error", async () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
      responseFormat: {
        success: (ctx) => ({ ok: true, status: 200, data: ctx.data }),
        error: (ctx) => ({
          ok: false,
          status: ctx.status,
          message: "Custom Server Error",
          raw: ctx.raw,
        }),
      },
    });

    const body = { name: "Fail" };
    mockFetch.mockResolvedValue(mockResponse({}, { status: 502 }));

    const res = await client.safePost("/create", { body });

    expect(res).toMatchObject({
      ok: false,
      status: 502,
      message: "Custom Server Error",
    });
  });

  it("safe methods respect request-level onError overrides", async () => {
    const client = createFetchClient({
      baseUrl: "https://example.com",
      responseFormat: {
        success: (ctx) => ({ ok: true, status: 200, data: ctx.data }),
        error: (ctx) => ({
          ok: false,
          status: ctx.status,
          message: "Original Error",
          raw: ctx.raw,
        }),
      },
    });

    mockFetch.mockResolvedValue(mockResponse({}, { status: 404 }));

    const res = await client.safeGet("/override", {
      onError: () => ({ ok: true, status: 200, data: "Recovered" }),
    });

    expect(res).toMatchObject({
      ok: true,
      status: 200,
      data: "Recovered",
    });
  });
});
