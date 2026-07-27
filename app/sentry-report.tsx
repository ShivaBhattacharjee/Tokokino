"use client"

import { useEffect } from "react"

// Reporting-only component with no UI. It exists so `global-error.tsx` can pull
// @sentry/browser in behind `ssr: false`: a bare `import()` inside an SSR'd
// client component is still server-compiled, and OpenNext bundles every server
// chunk into the Worker, which has a hard size limit.
export default function SentryReport({ error }: { error: Error }) {
  useEffect(() => {
    void import("@sentry/browser").then((Sentry) => {
      Sentry.captureException(error)
    })
  }, [error])

  return null
}
