import { apiError } from "@/lib/api-error"

function notFound(request: Request) {
  const { pathname } = new URL(request.url)
  return apiError({
    status: 404,
    code: "not_found",
    message: `No API endpoint matches ${pathname}`,
    hint: "Browse the published endpoints in https://tokokino.com/openapi.json",
  })
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const HEAD = notFound
export const OPTIONS = notFound
