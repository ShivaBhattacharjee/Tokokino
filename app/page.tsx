"use client"

import { DashedH } from "@/components/landing/dashed-h"
import { FeatureRow } from "@/components/landing/feature-row"
import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { Footer } from "@/components/landing/footer"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Nav } from "@/components/landing/nav"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { FlickeringGrid } from "@/components/ui/flickering-grid"

const CONTENT_WIDTH = "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export default function Page() {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={{ "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)" } as React.CSSProperties}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <FlickeringGrid color="rgb(255,255,255)" maxOpacity={0.035} flickerChance={0.08} squareSize={3} gridGap={8} className="h-full w-full" />
      </div>
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Hero />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <FeatureRow />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <HowItWorks />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Faq />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <FinalCta />
      </div>
      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Footer />
      </div>
      <ScrollToTop />
    </main>
  )
}
