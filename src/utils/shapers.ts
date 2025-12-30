import { FullResponseShaper, StandardResponse } from "../types";

export function createStandardShaper(): FullResponseShaper<
  StandardResponse<any>
> {
  return {
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

    redirect({ status, location }) {
      return {
        ok: false,
        redirected: true,
        status,
        location,
      };
    },
  };
}
