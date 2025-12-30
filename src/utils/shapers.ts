// ============================================================================
// Default Response Shaper
// ============================================================================

import { ResponseShaper, StandardResponse } from "../types";

function createStandardShaper(): ResponseShaper<StandardResponse<any>> {
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
  };
}

export { createStandardShaper };
