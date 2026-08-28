import type { Metadata } from "next"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"

import { DashedH } from "@/components/landing/dashed-h"
import { FaqColumn } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { Footer } from "@/components/landing/footer"
import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { HowItWorksFlow } from "@/components/landing/how-it-works-flow"
import { ArrowRight, StarIcon } from "@/components/landing/landing-svgs"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { VectorCard } from "@/components/landing/vector-card"
import {
  ClipVector,
  ClipboardVector,
  ContextVector,
  DepthVector,
  DevicesVector,
  EasingVector,
  ExportVector,
  FrameVector,
  ImportVector,
  LinkCardVector,
  RenderVector,
  ShapesVector,
  ShareVector,
  SlotsVector,
  StyleVector,
  TargetVector,
  TextVector,
  TimelineVector,
  TrimVector,
  UrlVector,
} from "@/components/landing/how-it-works-vectors"
import { howItWorksStructuredData } from "@/lib/seo/how-it-works-structured-data"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

export const metadata: Metadata = pageMetadata({
  title: "How Tokokino works — from raw capture to polished export",
  description:
    "A step-by-step walkthrough of the Tokokino editor: import a screenshot, video, URL, or social post, frame it, style the scene, animate a demo on the timeline, and export a PNG, WebP, GIF, or WebM.",
  path: "/how-it-works",
  type: "article",
})

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

const CAPTURE = [
  {
    title: "Screenshot file",
    vector: <ImportVector />,
    meta: "PNG · JPEG · WebP",
    body: "Drag and drop, paste from the clipboard, or pick a file.",
  },
  {
    title: "Live website",
    vector: <UrlVector />,
    meta: "Full page",
    body: "Paste a URL and Tokokino captures the page at a device viewport.",
  },
  {
    title: "Video and GIF",
    vector: <ClipVector />,
    meta: "MP4 · WebM · GIF",
    body: "Drop a recording. Imported GIFs are re-encoded to run as video.",
  },
  {
    title: "Social post",
    vector: <LinkCardVector />,
    meta: "X · Bluesky",
    body: "Paste a post link and it renders as a themeable card mockup.",
  },
] as const

const COMPOSE = [
  {
    title: "Device frames",
    vector: <DevicesVector />,
    meta: "Mockups",
    body: "iPhone, iPad, Pixel, Galaxy, MacBook, plus Safari, Chrome, and Arc chrome.",
  },
  {
    title: "Canvas shape",
    vector: <FrameVector />,
    meta: "Aspect · Radius",
    body: "Aspect ratio, padding, corner radius, border, tilt, and scale.",
  },
  {
    title: "Backgrounds",
    vector: <StyleVector />,
    meta: "Palettes",
    body: "Gradients, image packs, Unsplash, or a palette sampled from your capture.",
  },
  {
    title: "Depth and light",
    vector: <DepthVector />,
    meta: "6 shadows · 7 modes",
    body: "Shadow types, portrait depth-of-field, backdrop patterns, 3D tilt.",
  },
] as const

const CONTEXT = [
  {
    title: "Text layers",
    vector: <TextVector />,
    meta: "100+ fonts",
    body: "Stroke, shadow, blend modes, and opacity on every floating label.",
  },
  {
    title: "Images and shapes",
    vector: <ShapesVector />,
    meta: "106 shapes",
    body: "Logos, SVGs, and 3D shapes with their own z-index and filters.",
  },
  {
    title: "Annotations",
    vector: <ContextVector />,
    meta: "Arrows · Strokes",
    body: "Point at what matters on a layer that never touches the capture.",
  },
  {
    title: "Multi-shot slots",
    vector: <SlotsVector />,
    meta: "3 slots · 8 layouts",
    body: "Side by Side, Depth Duo, Fan Out, Scatter, Perspective, and more.",
  },
] as const

const ANIMATE = [
  {
    title: "Clips, not keyframes",
    vector: <TimelineVector />,
    meta: "Timeline",
    body: "Add a clip, change properties while it is selected, and it owns them.",
  },
  {
    title: "Easing you can drag",
    vector: <EasingVector />,
    meta: "Custom bezier",
    body: "Linear, cubic, in, out, in-out, out-circ, or a curve you pull by hand.",
  },
  {
    title: "Aim at one slot",
    vector: <TargetVector />,
    meta: "Per-slot",
    body: "Point a clip at a single capture slot instead of the whole canvas.",
  },
  {
    title: "Video on the same track",
    vector: <TrimVector />,
    meta: "Trim · Mute",
    body: "Imported footage trims and mutes alongside the motion you built.",
  },
] as const

const EXPORT = [
  {
    title: "Stills",
    vector: <ExportVector />,
    meta: "HD · 4K · 8K",
    body: "PNG, JPEG, or WebP at 1920, 3840, or 7680px wide.",
  },
  {
    title: "Video",
    vector: <RenderVector />,
    meta: "WebM · MP4 · GIF",
    body: "Encoded on your device with WebCodecs — no queue, no upload.",
  },
  {
    title: "Clipboard",
    vector: <ClipboardVector />,
    meta: "1080px PNG",
    body: "Copy straight out of the editor without touching the filesystem.",
  },
  {
    title: "Share link",
    vector: <ShareVector />,
    meta: "View tracking",
    body: "Publish a composition to a public page and watch the views land.",
  },
] as const

const STEP_SCHEMA = [
  {
    name: "Capture",
    anchor: "capture",
    body: "Drop a screenshot, paste from the clipboard, hand over a URL for Tokokino to capture at a chosen device viewport, or paste an X or Bluesky post link. Video and GIF files land on the same canvas.",
  },
  {
    name: "Compose",
    anchor: "compose",
    body: "Wrap the capture in a device mockup or browser chrome, choose the canvas aspect ratio, then set padding, corner radius, border, tilt, and scale. Pick a background and add shadow, depth-of-field, and a colour grade.",
  },
  {
    name: "Add context",
    anchor: "context",
    body: "Place text, logos, SVGs, and 3D shapes as layers. Draw arrows, shapes, and freehand strokes to point at what matters. Add up to three extra capture slots and arrange them with a layout preset.",
  },
  {
    name: "Animate",
    anchor: "animate",
    body: "Add clips to the per-canvas timeline, each owning the properties you changed while it was selected, with an easing curve you can drag by hand. Imported video trims on the same timeline.",
  },
  {
    name: "Export",
    anchor: "export",
    body: "Download a PNG, JPEG, or WebP at HD, 4K, or 8K, render the timeline as a GIF, WebM, or MP4 on your own device, copy straight to the clipboard, or publish a public link with view tracking.",
  },
] as const

const FAQS = [
  {
    q: "Do I need an account to follow these steps?",
    a: "No. Importing, editing, animating, and exporting all work without signing in. An account is only required for public share links, cloud drafts that follow you between devices, and saved custom presets.",
  },
  {
    q: "How long does one visual take?",
    a: "A framed screenshot on a styled background is usually under a minute — drop the capture, pick a template or preset, export. A keyframed demo takes longer because you are deciding what the motion should say, but the timeline is built for a handful of clips rather than a full edit.",
  },
  {
    q: "Can Tokokino take the screenshot for me?",
    a: "Yes. Paste a public URL and Tokokino captures the page at a device viewport you choose, including full-page captures. You can also paste an X or Bluesky post link to render the post itself as a mockup.",
  },
  {
    q: "How do I turn a screen recording into a demo?",
    a: "Drop the video onto the canvas. Trim and mute segments on the timeline, then add clips that keyframe zoom, position, tilt, and background so the camera moves with what you are showing. Export the result as WebM, MP4, or GIF.",
  },
  {
    q: "Does my capture get uploaded anywhere?",
    a: "Not by opening it. Editing and every export are done on your device, including video encoding. Files leave the browser only when you create a share link or save a cloud draft, and then it is the rendered output that is stored.",
  },
  {
    q: "What happens if I lose my connection?",
    a: "The editor can be kept on your device in one click, and your work in progress is stored in the browser, so it opens and keeps working with no network. Anything that needs the server — URL capture, share links — resumes when you are back online.",
  },
  {
    q: "Can I apply the same look to a whole set of screenshots?",
    a: "Yes. Save the look as a custom preset and re-apply it, or work in bulk edit mode, where multiple canvases sit on one board and can be styled and previewed together before export.",
  },
] as const

const outlineCtaClass =
  "group inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition hover:border-primary/45 hover:text-primary/80"

const linkClass =
  "font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"

type Card = {
  title: string
  vector: ReactNode
  meta: string
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

function CardRow({ cards }: { cards: readonly Card[] }) {
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

export default function HowItWorksPage() {
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
            howItWorksStructuredData({ steps: STEP_SCHEMA, faqs: FAQS })
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
        <section className="landing-page-in relative flex flex-col items-center px-5 pt-14 pb-14 text-center sm:px-8 sm:pt-20 sm:pb-20 lg:px-12">
          <span
            style={{ "--landing-rise-duration": "0.6s" } as CSSProperties}
            className="landing-rise font-mono text-[10px] tracking-[0.28em] text-primary/80 uppercase"
          >
            {"// How it works"}
          </span>
          <h1
            style={
              {
                "--landing-rise-from": "12px",
                "--landing-rise-duration": "0.7s",
                "--landing-rise-delay": "0.1s",
              } as CSSProperties
            }
            className="landing-rise mt-5 max-w-4xl text-[clamp(1.4rem,0.85rem+3.8vw,1.625rem)] leading-[1.1] font-medium tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.06] sm:tracking-[-0.03em] lg:text-[3.75rem]"
          >
            From a raw capture to{" "}
            <span className="text-primary">something worth shipping.</span>
          </h1>
          <p
            style={
              {
                "--landing-rise-duration": "0.6s",
                "--landing-rise-delay": "0.3s",
              } as CSSProperties
            }
            className="landing-rise mt-6 max-w-xl text-[13px] leading-[1.6] text-balance text-foreground/58 sm:text-[15px] sm:leading-relaxed"
          >
            One editor for product visuals. Import a screenshot, recording, URL,
            or social post, frame and style it, animate it on a timeline, then
            export a still or a video — all in your browser.
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
          <Section id="capture">
            <SectionHeader
              eyebrow="Step one"
              label="Capture"
              headline="Product work rarely starts"
              subhead="with a tidy image file"
              lead="Screenshots, recordings, live pages, and social posts all come in the same door. Whatever you bring becomes the same kind of canvas, so everything after this behaves identically."
            />
            <CardRow cards={CAPTURE} />
          </Section>

          <Section id="compose">
            <SectionHeader
              eyebrow="Step two"
              label="Compose"
              headline="Framing decides what it is"
              subhead="styling decides how it lands"
              lead="Every treatment here is non-destructive — the original capture is kept behind each crop, frame, and filter, so nothing you try is a one-way door. Save a finished look as a preset and re-apply it across a whole set."
            />
            <CardRow cards={COMPOSE} />

            <div className="mt-12 flex flex-col items-center gap-5 text-center">
              <p className="max-w-md text-sm leading-7 text-balance text-foreground/58">
                Rather not start from nothing? The template picker carries
                ready-made compositions, several of them already animated.
              </p>
              <Link href="/showcase" className={outlineCtaClass}>
                Showcase
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Section>

          <Section id="context">
            <SectionHeader
              eyebrow="Step three"
              label="Context"
              headline="A screenshot says here it is"
              subhead="context says here is what matters"
              lead="Labels, marks, and extra shots are what turn a picture of a screen into an explanation. Each one lives on its own layer, so you can rearrange the argument without re-cropping the evidence."
            />
            <CardRow cards={CONTEXT} />
          </Section>

          <Section id="animate">
            <SectionHeader
              eyebrow="Optional"
              label="Animate"
              headline="Motion built by describing states"
              subhead="not by scrubbing keyframes"
              lead="Each canvas carries its own timeline. The editor eases from the committed values into whatever a clip changed, so you write the destination and it works out the path."
            />
            <CardRow cards={ANIMATE} />
          </Section>

          <Section id="export">
            <SectionHeader
              eyebrow="Step four"
              label="Export"
              headline="The end of the same pipeline"
              subhead="not a separate render service"
              lead="Stills are rasterised from the canvas you have been looking at, and video is encoded on your own machine. The file appears without a queue, a watermark negotiation, or an upload."
            />
            <CardRow cards={EXPORT} />
          </Section>

          <Section id="overview">
            <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {"// End to end"}
            </span>
            <div className="mt-6">
              <HowItWorksFlow />
            </div>

            <div className="mt-12 flex flex-col items-center gap-5 text-center">
              <p className="max-w-md text-sm leading-7 text-balance text-foreground/58">
                The steps stay the same whatever you are making. The jobs people
                point them at do not.
              </p>
              <Link href="/use-cases" className={outlineCtaClass}>
                Use cases
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Section>

          <Section id="local-first">
            <SectionHeader
              eyebrow="Local-first"
              label="Where the work happens"
              headline="Opening a capture"
              subhead="does not upload it"
              lead={
                <>
                  Editing, rasterising, and video encoding all run in the
                  browser, and your work in progress is stored on the device, so
                  a reload or a dropped connection does not cost you the
                  composition. The server side is deliberately small and always
                  explicit: capturing a URL, fetching a social post, syncing a
                  cloud draft, publishing a share link. In each case it is the
                  request you made or the rendered output — never the source
                  capture sitting on your canvas. The project is open source
                  under AGPL-3.0, so the boundary can be read rather than
                  trusted; see the{" "}
                  <Link href="/about" className={linkClass}>
                    about page
                  </Link>{" "}
                  or the{" "}
                  <Link href="/privacy" className={linkClass}>
                    privacy policy
                  </Link>
                  .
                </>
              }
            />
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
