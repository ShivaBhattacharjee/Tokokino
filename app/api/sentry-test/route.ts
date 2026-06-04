import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const error = new Error("Tokokino Sentry API route test error")

  Sentry.logger.info("Tokokino Sentry API route test log", {
    log_source: "sentry_api_test",
  })

  Sentry.captureException(error, {
    tags: {
      route: "/api/sentry-test",
      source: "curl",
    },
  })

  await Sentry.flush(2000)

  return NextResponse.json(
    {
      ok: false,
      message: "Intentional Sentry API route test failure captured.",
      eventId: Sentry.lastEventId(),
    },
    { status: 500 },
  )
}
