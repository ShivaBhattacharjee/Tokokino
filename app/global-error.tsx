"use client"

import Link from "next/link"
import { useEffect } from "react"
import { RiArrowLeftLine, RiHome5Line, RiRefreshLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return

    void import("@sentry/browser").then((Sentry) => {
      Sentry.captureException(error)
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 20%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 28rem), radial-gradient(circle at 82% 76%, color-mix(in oklch, var(--accent-foreground) 24%, transparent), transparent 30rem)",
            }}
          />
          <section className="relative grid w-full max-w-4xl gap-8 border-y border-border/45 py-12 md:grid-cols-[0.8fr_1.2fr] md:items-center">
            <div className="font-mono text-[clamp(4rem,18vw,10rem)] leading-none font-semibold text-primary">
              500
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="font-mono text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Render interrupted
                </p>
                <h1 className="max-w-xl text-4xl leading-tight font-semibold text-balance md:text-6xl">
                  The canvas hit an unexpected error.
                </h1>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground md:text-base">
                  The issue has been reported to our team. Refresh the page or
                  return to a stable route.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => window.location.reload()}
                >
                  <RiRefreshLine className="size-4" />
                  Refresh
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/app">
                    <RiArrowLeftLine className="size-4" />
                    Editor
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/">
                    <RiHome5Line className="size-4" />
                    Home
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
