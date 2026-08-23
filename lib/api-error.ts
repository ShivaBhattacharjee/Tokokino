import "server-only"

import { NextResponse } from "next/server"

const SITE_URL = "https://tokokino.com"

export const API_ERROR_DOCS_URL = `${SITE_URL}/developers#errors`

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "unsupported_media_type"
  | "payload_too_large"
  | "rate_limited"
  | "internal_error"

const DEFAULT_HINTS: Record<ApiErrorCode, string> = {
  unauthorized: `Sign in at ${SITE_URL}/login and send the session cookie with the request. See ${SITE_URL}/auth.md.`,
  forbidden: "This account is not permitted to perform that action.",
  not_found: "Check the path and any resource id, then retry.",
  invalid_request:
    "Check the request body and query parameters against the OpenAPI schema.",
  unsupported_media_type:
    "Set a Content-Type the endpoint accepts, as listed in the OpenAPI schema.",
  payload_too_large: "Reduce the payload size and retry.",
  rate_limited: "Wait for the window to reset, then retry.",
  internal_error: "Retry shortly. If it persists, report it via /contact.",
}

export type ApiErrorInit = {
  status: number
  code: ApiErrorCode
  message: string
  hint?: string
  headers?: HeadersInit
}

/**
 * `error` repeats `message` because every existing client reads `data.error`
 * as a plain string. Dropping it would break them.
 */
export function apiErrorBody({
  code,
  message,
  hint,
}: Omit<ApiErrorInit, "status" | "headers">) {
  return {
    error: message,
    code,
    message,
    hint: hint ?? DEFAULT_HINTS[code],
    docs: API_ERROR_DOCS_URL,
  }
}

export function apiError({
  status,
  code,
  message,
  hint,
  headers,
}: ApiErrorInit) {
  return NextResponse.json(apiErrorBody({ code, message, hint }), {
    status,
    headers,
  })
}
