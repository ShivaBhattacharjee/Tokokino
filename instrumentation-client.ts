import posthog from "posthog-js"

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    // The editor is fully usable logged out, so exporting — the core action —
    // happens anonymously. Under the SDK default of `identified_only` those
    // events get no person profile and are never backfilled onto the user at
    // sign-in, which breaks exactly the funnel worth measuring: export →
    // auth gate → signup. `always` costs more per event but keeps that join.
    person_profiles: "always",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  })
} else if (process.env.NODE_ENV === "development") {
  console.error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
  )
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// The SDK is ~265 KB of parse + eval on the critical path. Holding it until
// idle trades capture of errors thrown in the first seconds of load for a
// faster time-to-interactive.
if (dsn) {
  const start = () => {
    void import("@sentry/browser").then((Sentry) => {
      Sentry.init({ dsn })
    })
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 5000 })
  } else {
    window.setTimeout(start, 2000)
  }
}

export function onRouterTransitionStart() {}
