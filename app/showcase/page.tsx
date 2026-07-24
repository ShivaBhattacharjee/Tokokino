import type { Metadata } from "next"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { ShowcaseGrid } from "@/components/landing/showcase-grid"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata: Metadata = {
  title: "Templates showcase — Tokokino",
  description:
    "Browse Tokokino's ready-made templates — device frames, backdrops, multi-device layouts, and animated reveals. Pick one to open it in the editor.",
  alternates: { canonical: "/showcase" },
}

export default function ShowcasePage() {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as React.CSSProperties
      }
    >
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="relative px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {"// Templates"}
            </span>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              Showcase
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              Ready-made compositions — frames, backdrops, shadows, layouts, and
              animated reveals. Click any one to open it in the editor and drop
              in your capture.
            </p>
          </div>

          <div className="mt-8 sm:mt-10">
            <ShowcaseGrid />
          </div>
        </section>
      </div>

      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Footer />
      </div>
      <ScrollToTop />
    </main>
  )
}
