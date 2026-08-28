import type { Metadata } from "next"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"

import { DashedH } from "@/components/landing/dashed-h"
import { DitherField } from "@/components/landing/dither-field"
import { FaqColumn } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { Footer } from "@/components/landing/footer"
import { HowItWorksFlow } from "@/components/landing/how-it-works-flow"
import { ArrowRight, StarIcon } from "@/components/landing/landing-svgs"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { VectorCard } from "@/components/landing/vector-card"
import {
  AnnounceVector,
  AppStoreVector,
  ChangelogVector,
  ClipboardVector,
  CompareVector,
  DeckVector,
  DemoVector,
  DocsVector,
  ExportVector,
  LandingVector,
  LaunchVector,
  MultiDeviceVector,
  RenderVector,
  ShareVector,
  SocialVector,
  WalkthroughVector,
} from "@/components/landing/how-it-works-vectors"
import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { useCasesStructuredData } from "@/lib/seo/use-cases-structured-data"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

export const metadata: Metadata = pageMetadata({
  title: "Use cases — what people build with Tokokino",
  description:
    "Launch posts, app store screenshots, animated product demos, changelog images, documentation stills, landing page visuals, and social proof — all from one browser-based editor.",
  path: "/use-cases",
})

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

const SHIPPING = [
  {
    title: "Launch posts",
    meta: "16:9 / 1:1",
    vector: <LaunchVector />,
    body: "A framed shot on a backdrop that suits your brand, at the ratio X, LinkedIn, or Product Hunt crops to.",
  },
  {
    title: "Product demo clips",
    meta: "GIF / WebM",
    vector: <DemoVector />,
    body: "Keyframe zooms and tilts over a screen recording so the viewer looks where you want them to.",
  },
  {
    title: "Changelog entries",
    meta: "Motion + labels",
    vector: <ChangelogVector />,
    body: "One image per release, annotated, with a saved preset keeping the treatment identical every time.",
  },
  {
    title: "Landing page visuals",
    meta: "4K / 8K",
    vector: <LandingVector />,
    body: "Hero and feature imagery at export widths that still look sharp on a retina display.",
  },
] as const

const DEVICES = [
  {
    title: "App store screenshots",
    meta: "9:16 frames",
    vector: <AppStoreVector />,
    body: "One capture in an iPhone, iPad, Pixel, or Galaxy frame, with a headline layer over the top.",
  },
  {
    title: "Tablet and desktop sets",
    meta: "Multi-device",
    vector: <MultiDeviceVector />,
    body: "The same screen shown across sizes, so a responsive product reads as one product.",
  },
  {
    title: "Side-by-side comparisons",
    meta: "3 extra slots",
    vector: <CompareVector />,
    body: "Before and after, or two flows at once, arranged with a layout preset instead of by hand.",
  },
  {
    title: "Presentation stills",
    meta: "16:9",
    vector: <DeckVector />,
    body: "Slide-ready shots for investor updates, sales decks, and internal reviews at a consistent ratio.",
  },
] as const

const EXPLAINING = [
  {
    title: "Docs and guides",
    meta: "Annotated stills",
    vector: <DocsVector />,
    body: "Crop to the region that matters and draw an arrow at the control you are describing.",
  },
  {
    title: "Feature announcements",
    meta: "Text + marks",
    vector: <AnnounceVector />,
    body: "Label the new thing, dim the rest, and let one image carry the whole explanation.",
  },
  {
    title: "Social proof",
    meta: "Post mockups",
    vector: <SocialVector />,
    body: "Render an X or Bluesky post as a styled card that belongs on your site rather than in a screenshot.",
  },
  {
    title: "Onboarding walkthroughs",
    meta: "Timeline",
    vector: <WalkthroughVector />,
    body: "A short loop that shows the path through a flow, exported small enough to autoplay inline.",
  },
] as const

const OUTPUT = [
  {
    title: "Stills",
    meta: "HD · 4K · 8K",
    vector: <ExportVector />,
    body: "PNG, JPEG, or WebP at 1920, 3840, or 7680px wide.",
  },
  {
    title: "Video",
    meta: "WebM · MP4 · GIF",
    vector: <RenderVector />,
    body: "Encoded on your own device with WebCodecs — no queue, no upload.",
  },
  {
    title: "Clipboard",
    meta: "1080px PNG",
    vector: <ClipboardVector />,
    body: "Copy straight out of the editor without touching the filesystem.",
  },
  {
    title: "Share link",
    meta: "View tracking",
    vector: <ShareVector />,
    body: "Publish a composition to a public page and watch the views land.",
  },
] as const

const FAQS = [
  {
    q: "Which use case should I start with?",
    a: "Whichever one you need this week. Every job on this page runs through the same five steps — import, frame, style, optionally animate, export — so the second visual you make is always faster than the first.",
  },
  {
    q: "Can I keep one look across a whole set?",
    a: "Yes. Save the treatment as a custom preset and re-apply it, or work in bulk edit mode where multiple canvases sit on one board and can be styled and previewed together before export.",
  },
  {
    q: "Do app store screenshots need specific sizes?",
    a: "Set the canvas aspect ratio to the one the store expects and export at 4K or 8K width. Device frames are applied non-destructively, so the same capture can be re-framed for a different store listing without redoing the composition.",
  },
  {
    q: "How small can an animated demo get?",
    a: "GIF and WebM are both bounded by the timeline length and canvas size you choose. Short loops of a few seconds at HD usually land in the low megabytes, which is small enough to autoplay in a README, a changelog, or a launch post.",
  },
  {
    q: "Is any of this paid?",
    a: "The editor and every export option are free, and no account is needed to make or download a visual. Signing in adds public share links, cloud drafts, and saved presets.",
  },
] as const

const outlineCtaClass =
  "group inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition hover:border-primary/45 hover:text-primary/80"

const linkClass =
  "font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"

type UseCase = {
  title: string
  meta: string
  vector: ReactNode
  body: string
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
  lead: ReactNode
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

function CardRow({ cards }: { cards: readonly UseCase[] }) {
  return (
    <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <VectorCard
          key={card.title}
          vector={card.vector}
          meta={card.meta}
          title={card.title}
          body={card.body}
        />
      ))}
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

export default function UseCasesPage() {
  const allCases = [...SHIPPING, ...DEVICES, ...EXPLAINING]

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
          __html: serializeJsonLd(
            useCasesStructuredData({
              cases: allCases.map((c) => ({ title: c.title, body: c.body })),
              faqs: FAQS,
            })
          ),
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0">
        <FlickeringGrid
          color="rgb(255,255,255)"
          maxOpacity={0.035}
          flickerChance={0.08}
          squareSize={3}
          gridGap={8}
          className="h-full w-full"
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
            {"// Use cases"}
          </span>
          <h1
            style={
              {
                "--landing-rise-from": "12px",
                "--landing-rise-duration": "0.7s",
                "--landing-rise-delay": "0.1s",
              } as CSSProperties
            }
            className="landing-rise mt-5 max-w-5xl text-[clamp(1.4rem,0.85rem+3.8vw,1.625rem)] leading-[1.1] font-medium tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.06] sm:tracking-[-0.03em] lg:text-[3.75rem]"
          >
            <span className="whitespace-nowrap">One editor,</span>
            <br />
            <span className="text-primary">a dozen jobs it does well.</span>
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
            Launch posts, store listings, demo clips, changelog images, docs
            stills, and social proof. Same workflow every time — the only thing
            that changes is where the file ends up.
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
          <Section id="shipping">
            <SectionHeader
              eyebrow="Shipping"
              label="Announcing"
              headline="Every release needs one image"
              subhead="that shows the new thing"
              lead="The visual attached to a launch post or a changelog entry does more work than the copy under it. These are the shapes that job usually takes."
            />
            <CardRow cards={SHIPPING} />
          </Section>

          <Section id="devices">
            <SectionHeader
              eyebrow="Listings"
              label="On device"
              headline="A screen inside a phone"
              subhead="reads as a product"
              lead="Device frames are applied non-destructively, so one capture can be re-framed for a different store listing or a wider layout without rebuilding the composition."
            />
            <CardRow cards={DEVICES} />
          </Section>

          <Section id="explaining">
            <SectionHeader
              eyebrow="Teaching"
              label="Explaining"
              headline="A screenshot says here it is"
              subhead="an annotated one says here is why"
              lead="Marks, labels, and short loops turn a picture of a screen into something a reader can follow. Each layer stays separate, so the argument can change without re-cropping the evidence."
            />
            <CardRow cards={EXPLAINING} />
          </Section>

          <Section id="output">
            <SectionHeader
              eyebrow="Output"
              label="What you walk away with"
              headline="Every job on this page"
              subhead="ends in a file or a link"
              lead="Stills are rasterised from the canvas you have been looking at and video is encoded on your own machine, so whatever you were making arrives without a render queue or an upload."
            />
            <CardRow cards={OUTPUT} />
          </Section>

          <Section id="how">
            <SectionHeader
              eyebrow="The method"
              label="Same five steps"
              headline="The job changes"
              subhead="the workflow does not"
              lead={
                <>
                  Import a capture, frame it, style the scene, optionally
                  animate it, then export. Every visual on this page came out of
                  that loop. The{" "}
                  <Link href="/how-it-works" className={linkClass}>
                    full walkthrough
                  </Link>{" "}
                  covers each step, or you can skip it and open the editor.
                </>
              }
            />
            <div className="mt-12">
              <HowItWorksFlow />
            </div>

            <div className="mt-12 flex flex-col items-center gap-5 text-center">
              <p className="max-w-md text-sm leading-7 text-balance text-foreground/58">
                Every card above started as a template. Swap your own capture in
                and the treatment comes with it.
              </p>
              <Link href="/showcase" className={outlineCtaClass}>
                Showcase
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Section>

          <Section id="faq">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
              <div className="shrink-0 md:w-64 md:pt-1">
                <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                  {"// FAQ"}
                </span>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
                  Questions
                </h2>
              </div>
              <div className="min-w-0 flex-1">
                <FaqColumn items={FAQS} />
              </div>
            </div>
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
