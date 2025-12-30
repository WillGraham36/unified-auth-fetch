# next-safe-fetch

A **TypeScript-first fetch client** that works **identically on client and server**, with automatic cookie/auth handling, standardized responses, consistent error handling, and configurable redirects.

> **Note:** This project is still early in development, APIs may change.

---

## Features

- **Universal:** Works on both client and server seamlessly.
- **Auth & Cookies:** Automatic forwarding of cookies and credentials.
- **Unified Responses:** JSON, text, HTML parsing with standardized structure.
- **Consistent Errors:** Normalized errors across environments.
- **Customizable:** All logic is extendable and customizable to fit your use case.

## Installation

This library **not** available via npm _(yet)_.

Install locally:

```bash
git clone https://github.com/WillGraham36/next-safe-fetch.git
cd next-safe-fetch
npm i
npm run build
```

## Basic Usage

You can use a single API object for both client and server requests.

This example uses Next.js cookie store, but all cookie stores are supported.

This example also uses a Java Sprinboot based backend that expects a JSESSIONID cookie for all authenticated API calls, once you set up this api object all calls made with it, both client and server side, will include that cookie correctly.

### 1. Setup API Object

```ts
import { createFetchClient } from "next-safe-fetch";
import { cookies } from "next/headers";

const isServer = typeof window === "undefined";
const cookieStore = isServer ? await cookies() : undefined;

export const api = createFetchClient({
  baseUrl: process.env.API_URL,
  auth: {
    server: isServer
      ? {
          enabled: true,
          cookies({ cookieStore }) {
            return { JSESSIONID: cookieStore.get("JSESSIONID")?.value || "" };
          },
        }
      : undefined,
    client: {
      enabled: true,
      credentials: "include",
    },
  },
});
```

### 2. Server Usage

```ts
"use server";
import { api } from "./lib/api";

const user = await api.get<User>("/me");
```

### 3. Client Usage

```ts
"use client";
import { api } from "./lib/api";

const user = await api.get<User>("/me");
```

---

## Standardized Responses

All responses are wrapped in a **standard structure** when using safe methods (`safeGet`, `safePost`, etc.):

```ts
const response = await api.safeGet<User>("/me");
console.log(response);
```

**Result:**

```ts
{
  ok: true,
  status: 200,
  data: { id: 1, name: "User1" },
  headers: Headers,
  raw: Response
}
```

The structure of the standardized responses (both successes and errors) can be customized when creating the API.

If no configuration is provided, it will default to a simple response format.

```ts
const api = createFetchClient({
  // ...

  responseFormat: {
    success({ data, response }) {
      return {
        ok: true,
        status: response.status,
        data,
        headers: response.headers,
        raw: response,
        customField1: "this will get returned with every success",
      };
    },
    error(ctx) {
      return {
        ok: false,
        status: ctx.status,
        message: ctx.message,
        data: ctx.parsedBody,
        raw: ctx.raw,
        customField2: "this will get returned with every error",
      };
    },
  },
});
```

## Error Handling

Errors are handled differently for normal and safe functions.

### Normal functions (get, post, etc.):

- Returns your type T on success.
- Throws on HTTP or other errors.
- Thrown errors can be raw or normalized depending on configuration defined in the `responseFormat` section.

```ts
try {
  const user = await api.get<User>("/me");
} catch (err) {
  console.log(err.message); // "HTTP 401: Unauthorized"
  console.log(err.ok); // false
}
```

### Safe functions (safeGet, safePost, etc.):

- Always returns a normalized response of type `StandardResponse<T>` that was defined in defined in `responseFormat`.
- Never throws, even on errors.
- Global error handlers still run.

```ts
const user = await api.get<User>("/me");
if (result.ok) {
  console.log(result.data.id, result.data.name);
} else {
  console.error("Error fetching user:", result.message);
}
```

## Redirect Side Effects

Optional side effects for redirects can be enabled

```ts
const api = createFetchClient({
  // ...

  redirects: {
    onRedirectSideEffect(ctx) {
      console.log(
        `Redirected to: ${ctx.location} with status code ${ctx.status}`
      );
    },
  },
});
```

Result for **all** redirects:

```ts
Redirecting to: /login with status code 302
```

## Testing

Run tests with Vitest:

```bash
npx vitest run
```

Watch mode:

```bash
npx vitest
```

---

## v2 Roadmap

- Request validation (Zod or other libraries)
- Framework adapters (Next.js, Remix, SvelteKit, etc.)
- Request deduping
- Abort/cancellation support
- Edge runtime stabilization
