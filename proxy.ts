import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const DEFAULT_AUTH_REDIRECT = "/app"

function getAuthenticatedRedirect(request: NextRequest) {
  const callbackURL = request.nextUrl.searchParams.get("callbackURL")

  if (!callbackURL) {
    return new URL(DEFAULT_AUTH_REDIRECT, request.url)
  }

  try {
    const redirectURL = new URL(callbackURL, request.url)

    if (
      redirectURL.origin !== request.nextUrl.origin ||
      redirectURL.pathname === "/login"
    ) {
      return new URL(DEFAULT_AUTH_REDIRECT, request.url)
    }

    return redirectURL
  } catch {
    return new URL(DEFAULT_AUTH_REDIRECT, request.url)
  }
}

export function proxy(request: NextRequest) {
  const sessionToken = getSessionCookie(request)

  if (!sessionToken) {
    return NextResponse.next()
  }

  return NextResponse.redirect(getAuthenticatedRedirect(request))
}

export const config = {
  matcher: ["/login"],
}
