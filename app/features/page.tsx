import type { Metadata } from "next"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"

import { DashedH } from "@/components/landing/dashed-h"
import { DitherField } from "@/components/landing/dither-field"
import {
  AnnotationsTextVector,
  AutoPalettesVector,
  BlueskyPostsVector,
  BulkEditPreviewVector,
  CaptureUrlVector,
  CustomPresetsVector,
  DepthFocusVector,
  DeviceFramesVector,
  ExportAnywhereVector,
  LayersAssetsVector,
  LocalFirstVector,
  MultiShotLayoutsVector,
  ShadowsEffectsVector,
  ShareLinksVector,
  StarterTemplatesVector,
  TimelineDemosVector,
  WorksOfflineVector,
  XPostsVector,
} from "@/components/landing/feature-vectors"
import { FinalCta } from "@/components/landing/final-cta"
import { Footer } from "@/components/landing/footer"
import { ArrowRight, StarIcon } from "@/components/landing/landing-svgs"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { VectorCard } from "@/components/landing/vector-card"
import { FEATURES } from "@/components/landing/constants"
import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

export const metadata: Metadata = pageMetadata({
  title: "Features — everything inside the Tokokino editor",
  description:
    "Explore every Tokokino feature: device frames, auto palettes, layers, annotations, multi-shot layouts, timeline animation, URL and social capture, local-first editing, high-resolution export, and public sharing.",
  path: "/features",
  type: "article",
})

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

type FeatureKey = (typeof FEATURES)[number]["k"]

type FeatureCard = {
  key: FeatureKey
  meta: string
  vector: ReactNode
}

function card(key: FeatureKey, meta: string, vector: ReactNode): FeatureCard {
  return { key, meta, vector }
}

const FRAME_AND_STYLE = [
  card("01", "Phones · Desktop", <DeviceFramesVector />),
  card("02", "Sampled colour", <AutoPalettesVector />),
  card("03", "6 shadow types", <ShadowsEffectsVector />),
  card("17", "6 portrait modes", <DepthFocusVector />),
] as const

const BUILD_THE_SCENE = [
  card("05", "Text · Image · SVG", <LayersAssetsVector />),
  card("06", "Arrows · 100+ fonts", <AnnotationsTextVector />),
  card("10", "3 extra slots", <MultiShotLayoutsVector />),
  card("16", "Static · Animated", <StarterTemplatesVector />),
] as const

const CAPTURE_ANYTHING = [
  card("11", "Light · Dim · Dark", <XPostsVector />),
  card("12", "Posts · Link cards", <BlueskyPostsVector />),
  card("13", "Viewport · Full page", <CaptureUrlVector />),
] as const

const MOTION_AND_WORKFLOW = [
  card("08", "Timeline · Audio", <TimelineDemosVector />),
  card("14", "Save · Reapply", <CustomPresetsVector />),
  card("15", "Board · Preview", <BulkEditPreviewVector />),
  card("09", "Browser editing", <LocalFirstVector />),
] as const

const DELIVERY_AND_ACCESS = [
  card("07", "HD · 4K · 8K", <ExportAnywhereVector />),
  card("18", "Public · Tracked", <ShareLinksVector />),
  card("19", "No connection", <WorksOfflineVector />),
] as const

const FEATURE_BY_KEY = new Map(FEATURES.map((feature) => [feature.k, feature]))

const featuresStructuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://tokokino.com/features/#page",
  name: "Tokokino features",
  description:
    "A detailed guide to every major capability in the Tokokino editor.",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: FEATURES.map((feature, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://tokokino.com/features/#feature-${feature.k}`,
      name: feature.t,
      description: feature.d,
    })),
  },
}

function SectionHeader({
  eyebrow,
  label,
  headline,
  subhead,
  lead,
}: {
  eyebrow: string
  label: string
  headline: string
  subhead: string
  lead: string
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
      <div>
        <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
          {`// ${eyebrow}`}
        </span>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
          {label}
        </h2>
      </div>
      <div className="max-w-xl">
        <p className="text-2xl leading-[1.2] font-medium tracking-[-0.025em] text-balance sm:text-3xl">
          {headline}
          <br />
          <span className="text-foreground/45">{subhead}</span>
        </p>
        <p className="mt-6 text-sm leading-7 text-foreground/58">{lead}</p>
      </div>
    </div>
  )
}

function CardRow({ cards }: { cards: readonly FeatureCard[] }) {
  const columns = cards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"

  return (
    <div className={`mt-12 grid gap-3 sm:grid-cols-2 ${columns}`}>
      {cards.map((item) => {
        const feature = FEATURE_BY_KEY.get(item.key)
        if (!feature) return null

        return (
          <div
            id={`feature-${item.key}`}
            key={item.key}
            className="scroll-mt-24"
          >
            <VectorCard
              vector={item.vector}
              meta={item.meta}
              title={feature.t}
              body={feature.d}
            />
          </div>
        )
      })}
    </div>
  )
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-border/50 pt-14 first:border-t-0 first:pt-0"
    >
      {children}
    </section>
  )
}

export default function FeaturesPage() {
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
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(featuresStructuredData),
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0">
        <FlickeringGrid
          color="rgb(0,0,0)"
          maxOpacity={0.035}
          flickerChance={0.08}
          squareSize={3}
          gridGap={8}
          className="h-full w-full dark:invert"
        />
      </div>

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="landing-page-in relative flex flex-col items-center overflow-hidden px-5 pt-14 pb-14 text-center sm:px-8 sm:pt-20 sm:pb-20 lg:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-35"
            style={{
              maskImage:
                "linear-gradient(to top left, black 5%, transparent 62%)",
              WebkitMaskImage:
                "linear-gradient(to top left, black 5%, transparent 62%)",
            }}
          >
            <DitherField cell={6} speed={0.35} intensity={0.7} />
          </div>

          <span
            style={{ "--landing-rise-duration": "0.6s" } as CSSProperties}
            className="landing-rise font-mono text-[10px] tracking-[0.28em] text-primary/80 uppercase"
          >
            {"// Features"}
          </span>
          <h1
            style={
              {
                "--landing-rise-from": "12px",
                "--landing-rise-duration": "0.7s",
                "--landing-rise-delay": "0.1s",
              } as CSSProperties
            }
            className="landing-rise mt-5 max-w-5xl text-[clamp(1.4rem,0.85rem+3.8vw,1.625rem)] leading-[1.1] font-medium tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.06] sm:tracking-[-0.03em] lg:max-w-none lg:text-[3.4rem] xl:text-[3.75rem]"
          >
            <span className="lg:whitespace-nowrap">
              Everything between a raw capture
            </span>
            <br />
            <span className="text-primary lg:whitespace-nowrap">
              and a visual worth shipping.
            </span>
          </h1>
          <p
            style={
              {
                "--landing-rise-duration": "0.6s",
                "--landing-rise-delay": "0.3s",
              } as CSSProperties
            }
            className="landing-rise mt-6 max-w-2xl text-[13px] leading-[1.6] text-balance text-foreground/58 sm:text-[15px] sm:leading-relaxed"
          >
            Capture a screen, build the scene around it, add context or motion,
            and deliver the result as a file or a link. Every stage stays
            editable in one browser workspace.
          </p>
          <div
            style={
              {
                "--landing-rise-duration": "0.6s",
                "--landing-rise-delay": "0.4s",
              } as CSSProperties
            }
            className="landing-rise mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95"
            >
              Start editing
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://git.new/Tokokino"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground/70 backdrop-blur-sm transition hover:border-foreground/30 hover:text-foreground"
            >
              <StarIcon className="size-3.5 text-yellow-400" />
              Star on GitHub
            </a>
          </div>
        </section>
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <div className="landing-page-in flex flex-col gap-14 px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
          <Section id="frame-and-style">
            <SectionHeader
              eyebrow="Presentation"
              label="Frame and style"
              headline="Give the screen a place"
              subhead="then make that place feel intentional"
              lead="Frames establish the product, while sampled colour, depth, and light connect it to the canvas. Every treatment stays adjustable after the capture is placed."
            />
            <CardRow cards={FRAME_AND_STYLE} />
          </Section>

          <Section id="build-the-scene">
            <SectionHeader
              eyebrow="Composition"
              label="Build the scene"
              headline="One capture can carry"
              subhead="more context than it arrived with"
              lead="Layer in explanations, supporting assets, and additional screens without flattening the work. Templates and layout presets handle the starting geometry."
            />
            <CardRow cards={BUILD_THE_SCENE} />
          </Section>

          <Section id="capture-anything">
            <SectionHeader
              eyebrow="Input"
              label="Capture anything"
              headline="Bring in the live thing"
              subhead="without rebuilding it by hand"
              lead="A website or social post becomes structured source material for the same editor, ready to frame, annotate, animate, and export alongside ordinary screenshots."
            />
            <CardRow cards={CAPTURE_ANYTHING} />
          </Section>

          <Section id="motion-and-workflow">
            <SectionHeader
              eyebrow="Workflow"
              label="Motion and repetition"
              headline="Build the first treatment"
              subhead="then make the next one faster"
              lead="Animate on a per-canvas timeline, preview a whole set together, and save finished treatments as reusable presets. Editing stays local throughout the process."
            />
            <CardRow cards={MOTION_AND_WORKFLOW} />
          </Section>

          <Section id="delivery-and-access">
            <SectionHeader
              eyebrow="Output"
              label="Delivery and access"
              headline="Leave with a sharp file"
              subhead="a useful link, or both"
              lead="High-resolution stills and motion exports are produced from the canvas you edited. Sharing is deliberate, while the core editor remains available locally and offline."
            />
            <CardRow cards={DELIVERY_AND_ACCESS} />
          </Section>
        </div>
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
