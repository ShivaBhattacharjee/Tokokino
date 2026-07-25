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
