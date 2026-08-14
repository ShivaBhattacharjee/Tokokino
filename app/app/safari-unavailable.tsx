"use client"

import { RiArrowLeftLine, RiChromeLine } from "@remixicon/react"
import Link from "next/link"

import { BrandLogo } from "@/components/editor/brand-logo"
import { CornerMarkers } from "@/components/editor/corner-marker"
import { SummaryRow, TopBarButton } from "@/components/editor/top-bar/ui"
import { Button } from "@/components/ui/button"

const BROWSER_ROWS = [
  { browser: "Google Chrome", status: "Recommended" },
  { browser: "Microsoft Edge", status: "Supported" },
  { browser: "Safari", status: "Unavailable" },
] as const

const SHELL_WIDTH =
  "mx-auto w-[calc(100%-1rem)] max-w-304 sm:w-[calc(100%-2rem)]"
const SHELL_GUTTER = "px-5 sm:px-8 lg:px-12"

export function SafariUnavailable() {
  const openChromeDownload = () => {
    window.open(
      "https://www.google.com/chrome/",
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <div className={`relative min-h-full ${SHELL_WIDTH}`}>
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 border-l border-dashed border-border/60"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 border-r border-dashed border-border/60"
        />

        <header
          className={`flex h-14 items-center border-b border-dashed border-border/70 ${SHELL_GUTTER}`}
        >
          <BrandLogo markClassName="size-8" wordmarkClassName="text-base" />
        </header>

        <main
          className={`flex min-h-[calc(100svh-3.5rem)] items-center py-16 sm:py-24 ${SHELL_GUTTER}`}
        >
          <section className="relative grid w-full gap-12 border-y border-dashed border-border/70 py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-20">
            <CornerMarkers className="text-border" size={12} />

            <div className="max-w-xl">
              <p className="mb-5 font-mono text-[10px] tracking-[0.16em] text-primary uppercase">
                Safari detected
              </p>
              <h1 className="text-4xl leading-[1.06] font-medium tracking-[-0.035em] text-balance sm:text-5xl">
                The Tokokino editor isn&apos;t available in Safari.
              </h1>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Tokokino relies on browser graphics and export APIs that Safari
                does not render consistently. Open this page in Google Chrome or
                Microsoft Edge for reliable editing and exports.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <TopBarButton
                  label="Get Google Chrome"
                  icon={RiChromeLine}
                  variant="default"
                  alwaysShowLabel
                  className="h-10 px-5 text-sm"
                  onClick={openChromeDownload}
                />
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-10 px-5 text-sm"
                >
                  <Link href="/">
                    <RiArrowLeftLine />
                    Back
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative rounded-[20px] border border-border/60 bg-card/40 p-1">
              <CornerMarkers className="text-border" size={10} />
              <div className="rounded-[14px] border border-border/60 bg-background/60 p-5 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-4">
                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      Editor compatibility
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Desktop browsers
                    </p>
                  </div>
                  <span className="size-2 rounded-full bg-primary" />
                </div>

                <div className="divide-y divide-border/60 py-2">
                  {BROWSER_ROWS.map(({ browser, status }) => (
                    <SummaryRow key={browser} label={browser} value={status} />
                  ))}
                </div>

                <p className="border-t border-dashed border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
                  Signed-in cloud drafts remain available in Chrome.
                  Browser-local drafts do not transfer between Safari and
                  Chrome.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
