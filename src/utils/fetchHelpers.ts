function buildUrl(
  baseUrl: string | undefined,
  path: string,
  params?: Record<string, unknown>
): string {
  const base = baseUrl ?? "";
  const full = path.startsWith("http") ? path : `${base}${path}`;
  const url = new URL(full);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

function mergeHeaders(...inputs: (HeadersInit | undefined)[]): Headers {
  const h = new Headers();
  for (const input of inputs) {
    if (!input) continue;
    new Headers(input).forEach((v, k) => h.set(k, v));
  }
  return h;
}

async function parseResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

export { buildUrl, mergeHeaders, parseResponse };
