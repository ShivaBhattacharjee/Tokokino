import type { CSSProperties } from "react"
import Link from "next/link"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { getAllGuides } from "@/lib/guides"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

import {
  FeaturedGuideCard,
  GuideGridCard,
} from "@/components/guides/guide-card"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata = pageMetadata({
  title: "Guides | Tokokino",
  description:
    "Get to know Tokokino and learn how to turn screenshots and recordings into product visuals.",
  path: "/guides",
  type: "website",
  keywords: [
    "Tokokino guides",
    "product screenshots",
    "screenshot editor tutorials",
  ],
})

const H_RAIL_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "14px 1px",
  backgroundRepeat: "repeat-x",
}

const V_MID_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to bottom, var(--rail) 0px, var(--rail) 6px, transparent 6px, transparent 14px)",
  backgroundSize: "1px 14px",
  backgroundRepeat: "repeat-y",
  backgroundPosition: "center top",
}

export default function GuidesPage() {
  const all = getAllGuides()
  const latest = all[0]
  const rest = all.slice(1)

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": "https://tokokino.com/guides/#page",
    name: "Tokokino Guides",
    description: "Practical guides for the Tokokino editor.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: all.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://tokokino.com/guides/${guide.slug}`,
        name: guide.title,
        description: guide.excerpt,
      })),
    },
  }

  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="relative px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {"// Guides"}
            </span>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Guides
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              Get to know Tokokino, what you can make with it, and where to
              start.
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {all.length} {all.length === 1 ? "guide" : "guides"} · Updated{" "}
              {new Date(
                (latest?.date ?? "2026-09-07") + "T12:00:00Z"
              ).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </section>
      </div>

      <DashedH />

      {latest && (
        <>
          <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
            <section className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
              <div className="mb-3 font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                Latest
              </div>
              <FeaturedGuideCard guide={latest} />
            </section>
          </div>
          <DashedH />
        </>
      )}

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-px md:block"
            style={V_MID_STYLE}
          />

          <div className="grid grid-cols-1 md:grid-cols-2">
            {rest.map((guide, index) => {
              const isTopRow = index < 2
              const showTopBorder = !isTopRow

              return (
                <div
                  key={guide.slug}
                  className={`relative ${showTopBorder ? "border-t border-transparent" : ""}`}
                >
                  {showTopBorder && (
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px md:col-span-2"
                      style={H_RAIL_STYLE}
                    />
                  )}
                  <div className="px-5 py-8 sm:px-8 sm:py-9 lg:px-12">
                    <GuideGridCard guide={guide} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8 sm:py-12 lg:px-12">
          <h2 className="text-lg font-medium tracking-tight sm:text-xl">
            Want a guide we haven&apos;t written yet?
          </h2>
          <p className="max-w-md text-sm leading-7 text-foreground/58">
            Tell us what you want to make or learn next.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            Request a guide
          </Link>
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
