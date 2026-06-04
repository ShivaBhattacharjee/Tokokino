const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  void import("@sentry/browser").then((Sentry) => {
    Sentry.init({ dsn })
  })
}

export function onRouterTransitionStart() {}
