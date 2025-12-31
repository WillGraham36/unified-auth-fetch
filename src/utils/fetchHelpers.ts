function buildUrl(
  baseUrl: string | undefined,
  path: string,
  params?: Record<string, unknown>
): string {
  const isAbsolute = /^https?:\/\//i.test(path);

  if (!isAbsolute && !baseUrl) {
    throw new Error(`Relative path "${path}" requires a baseUrl`);
  }

  // Strip leading slash to avoid URL constructor issues
  const normalizedPath =
    !isAbsolute && path.startsWith("/") ? path.slice(1) : path;

  const url = isAbsolute
    ? new URL(path)
    : new URL(
        normalizedPath,
        baseUrl!.endsWith("/") ? baseUrl! : baseUrl! + "/"
      );

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) {
        url.searchParams.set(k, String(v));
      }
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
