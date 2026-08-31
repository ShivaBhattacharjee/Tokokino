import type { Metadata } from "next"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"

import {
  AboutBannerVector,
  BoundaryVector,
  BrowserVector,
  DeviceStoreVector,
  MotionVector,
  OpenSourceVector,
  SoloVector,
  PresetVector,
  ServerVector,
} from "@/components/landing/about-vectors"
import { DashedH } from "@/components/landing/dashed-h"
import { DitherField } from "@/components/landing/dither-field"
import { FinalCta } from "@/components/landing/final-cta"
import { Footer } from "@/components/landing/footer"
import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { ArrowRight, StarIcon } from "@/components/landing/landing-svgs"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { VectorCard } from "@/components/landing/vector-card"
import { aboutStructuredData } from "@/lib/seo/about-structured-data"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

export const metadata: Metadata = pageMetadata({
  title: "About Tokokino — a local-first editor for product visuals",
  description:
    "Why Tokokino exists, where the work actually runs, the decisions that shape the product, and who maintains the open-source project.",
  path: "/about",
  type: "article",
})

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

const PIPELINE = ["Capture", "Compose", "Context", "Animate", "Export"] as const

const PRINCIPLES = [
  {
    title: "Local-first by default",
    body: "Editing, rasterising, and video encoding run in your browser. Nothing is uploaded because you opened it.",
  },
  {
    title: "One canvas for stills and motion",
    body: "Make the still first, then animate the same canvas. There is no need to rebuild it in another tool.",
  },
  {
    title: "Presets over repetition",
    body: "If you like a look, save it and use it again instead of rebuilding it for every screenshot.",
  },
  {
    title: "Open enough to be read",
    body: "The source is public under AGPL-3.0, so the privacy boundary can be checked rather than trusted.",
  },
  {
    title: "Small on purpose",
    body: "Tokokino focuses on product visuals. Illustration and long-form video are better handled by other tools.",
  },
] as const

const BOUNDARY = [
  {
    title: "In your browser",
    vector: <BrowserVector />,
    meta: "Editing · Export",
    body: "The canvas, every still raster, and video encoding through WebCodecs — all on your own machine.",
  },
  {
    title: "On your device",
    vector: <DeviceStoreVector />,
    meta: "Drafts · Offline",
    body: "Work in progress is stored locally, and the editor can be installed to keep working with no network.",
  },
  {
    title: "On the server, when asked",
    vector: <ServerVector />,
    meta: "Explicit calls",
    body: "Capturing a URL, fetching a social post, syncing a cloud draft, publishing a share link. Nothing implicit.",
  },
  {
    title: "Never by default",
    vector: <BoundaryVector />,
    meta: "Source captures",
    body: "The file you dropped on the canvas stays with you. Sharing sends the rendered result, not the source.",
  },
] as const

const linkClass =
  "font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"

const solidCtaClass =
  "group inline-flex w-fit items-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95"

const outlineCtaClass =
  "group inline-flex w-fit items-center gap-2 rounded-md border border-border/70 bg-background/40 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-sm transition hover:border-primary/45 hover:text-foreground"

const FACTS = [
  { label: "Maintainer", value: "Shiva Bhattacharjee" },
  { label: "Based in", value: "Guwahati, India" },
  { label: "License", value: "AGPL-3.0" },
  { label: "Project", value: "Independent" },
] as const

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
        <div className="mt-6 text-sm leading-7 text-foreground/58">{lead}</div>
      </div>
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

export default function AboutPage() {
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
            aboutStructuredData({ principles: PRINCIPLES })
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
            {"// About"}
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
            <span className="whitespace-nowrap">One small editor for</span>
            <br />
            <span className="text-primary">the visuals a product needs.</span>
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
            Tokokino is an open-source, local-first editor for polished
            screenshots, mockups, social visuals, and short animated product
            demos. I build and maintain it independently.
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
          <Section id="mission">
            <SectionHeader
              eyebrow="Mission"
              label="Why does it exist?"
              headline="visual = fn(capture)"
              subhead="Raw material in, something shippable out"
              lead={
                <>
                  <p>
                    Product visuals rarely begin ready to share. Usually you
                    have a screenshot at the wrong size, a recording that is too
                    long, or a page hidden behind a login. Then comes the same
                    cleanup every time: add a frame, fix the spacing, choose a
                    background, highlight what matters, and export it at the
                    right size.
                  </p>
                  <p className="mt-4">
                    Tokokino puts that whole workflow in one place. Start with
                    the capture, add a device mockup or browser frame, combine
                    multiple shots, save the look as a preset, and export at a
                    useful resolution without moving everything into a general
                    design tool.
                  </p>
                </>
              }
            />

            <div className="mt-12 rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
              <div className="rounded-[8px] border border-border/40 bg-background/60 px-4 py-8 sm:px-10 sm:py-10">
                <div className="mx-auto aspect-[16/5] w-full max-w-4xl">
                  <AboutBannerVector />
                </div>
                <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  {PIPELINE.map((step, index) => (
                    <span
                      key={step}
                      className="flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-foreground/40 uppercase"
                    >
                      <span className="text-primary/70">0{index + 1}</span>
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section id="principles">
            <SectionHeader
              eyebrow="How it is built"
              label="Principles"
              headline="Five decisions"
              subhead="that shape everything else"
              lead="These choices keep Tokokino fast and focused. It does not need to do everything; it needs to make product visuals really well."
            />

            <ol className="mt-12 border-t border-border/50">
              {PRINCIPLES.map((principle, index) => (
                <li
                  key={principle.title}
                  className="grid gap-2 border-b border-border/50 py-5 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.15fr)] md:items-baseline md:gap-6"
                >
                  <span className="font-mono text-[11px] text-primary/70 tabular-nums">
                    0{index + 1}
                  </span>
                  <h3 className="text-[15px] font-medium tracking-tight text-foreground">
                    {principle.title}
                  </h3>
                  <p className="text-[13px] leading-6 text-foreground/52">
                    {principle.body}
                  </p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="local-first">
            <SectionHeader
              eyebrow="Local-first"
              label="Where the work happens"
              headline="Opening a capture"
              subhead="does not upload it"
              lead={
                <>
                  The editor runs in your browser, and you do not need an
                  account to edit or export. Online features only run when you
                  choose them: signing in lets you save cloud drafts, and
                  creating a share link uploads the finished result. The details
                  are explained in the{" "}
                  <Link href="/privacy" className={linkClass}>
                    privacy policy
                  </Link>{" "}
                  and readable in the source.
                </>
              }
            />

            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BOUNDARY.map((card) => (
                <VectorCard
                  key={card.title}
                  vector={card.vector}
                  meta={card.meta}
                  title={card.title}
                  body={card.body}
                />
              ))}
            </div>
          </Section>

          <Section id="motion">
            <SectionHeader
              eyebrow="Scope"
              label="Stills and motion"
              headline="One editor for the picture"
              subhead="and for the picture moving"
              lead="Use the same canvas for polished PNG, JPEG, and WebP images or short animated demos. The timeline can animate zoom, tilt, lighting, backgrounds, and filters, while video and GIF inputs can be cropped, trimmed, and muted. Tokokino is focused on product visuals, not illustration or long-form video editing."
            />

            <div className="mt-12 grid gap-3 sm:grid-cols-2">
              <VectorCard
                vector={<MotionVector />}
                meta="Timeline · WebM · GIF"
                title="Motion on the same canvas"
                body="Animate the properties you want, preview the result, and export it on your own device."
              />
              <VectorCard
                vector={<PresetVector />}
                meta="Templates · Presets"
                title="A look you can re-apply"
                body="Save a finished style once and apply it to the next screenshot without rebuilding it."
              />
            </div>
          </Section>

          <Section id="open-source">
            <SectionHeader
              eyebrow="Open source"
              label="How it is maintained"
              headline="Published under AGPL-3.0"
              subhead="so anyone can see how it works"
              lead={
                <>
                  The source is public. You can read the code, report a problem,
                  suggest an improvement, contribute, or self-host it under the
                  terms of the license. New releases are listed in the{" "}
                  <Link href="/changelog" className={linkClass}>
                    changelog
                  </Link>
                  .
                </>
              }
            />

            <div className="mt-12 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <VectorCard
                vector={<OpenSourceVector />}
                meta="AGPL-3.0"
                title="Built in the open"
                body="Issues, pull requests, and the whole editor history live in the public repository."
              />

              <div className="h-full rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
                <div className="flex h-full flex-col justify-between rounded-[8px] border border-border/40 bg-background/60 p-6">
                  <div className="flex flex-col gap-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/36 uppercase">
                      Get involved
                    </span>
                    <p className="text-sm leading-7 text-foreground/58">
                      Found a bug or have an idea that would make the editor
                      better? Open an issue on GitHub. That is where I keep
                      track of what needs attention.
                    </p>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href="https://git.new/Tokokino"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={solidCtaClass}
                    >
                      Browse the source
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                    <Link href="/changelog" className={outlineCtaClass}>
                      Read the changelog
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section id="maintainer">
            <SectionHeader
              eyebrow="Who"
              label="The person behind it"
              headline="Built independently"
              subhead="from Guwahati, India"
              lead={
                <>
                  I&apos;m Shiva, and I build and maintain Tokokino. I keep the
                  project focused on making product visuals, and I read the
                  questions, bug reports, and ideas people send. The{" "}
                  <Link href="/contact" className={linkClass}>
                    contact page
                  </Link>{" "}
                  is the easiest way to reach me.
                </>
              }
            />

            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
              <VectorCard
                vector={<SoloVector />}
                meta="One maintainer"
                title="Made by one person"
                body="Tokokino is a personal open-source project, built and maintained by Shiva Bhattacharjee."
              />

              <div className="h-full rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
                <div className="flex h-full flex-col justify-between rounded-[8px] border border-border/40 bg-background/60 p-6">
                  <dl className="grid gap-px overflow-hidden rounded-md border border-border/50 bg-border/45">
                    {FACTS.map((fact) => (
                      <div
                        key={fact.label}
                        className="grid items-baseline gap-1 bg-background/70 px-4 py-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)] sm:gap-4"
                      >
                        <dt className="font-mono text-[10px] tracking-[0.2em] text-foreground/36 uppercase">
                          {fact.label}
                        </dt>
                        <dd className="text-[13px] font-medium text-foreground">
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/contact" className={solidCtaClass}>
                      Get in touch
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/showcase" className={outlineCtaClass}>
                      See the showcase
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
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
