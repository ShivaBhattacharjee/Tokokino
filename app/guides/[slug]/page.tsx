import type { CSSProperties } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { DashedH } from "@/components/landing/dashed-h"
import { DocIndex, type DocIndexItem } from "@/components/landing/doc-index"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { RiHomeLine, RiTimeLine } from "@remixicon/react"

import { CopyUrlButton } from "@/components/guides/copy-url-button"
import { FrameIllustration } from "@/components/guides/frame-illustration"
import { CaptureIllustration } from "@/components/guides/capture-illustration"
import { GuideCover } from "@/components/guides/guide-cover"
import { SectionLinkHandler } from "@/components/guides/section-link-handler"
import { StoryIllustration } from "@/components/guides/story-illustration"
import { Markdown } from "@/components/guides/markdown"
import { formatGuideDate, getAllGuides, getGuideBySlug } from "@/lib/guides"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { serializeJsonLd } from "@/lib/seo/tokokino-structured-data"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export function generateStaticParams() {
  return getAllGuides().map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}

  const publishedTime = new Date(guide.date + "T12:00:00Z").toISOString()

  return pageMetadata({
    title: `${guide.title} | Guides`,
    description: guide.excerpt,
    path: `/guides/${slug}`,
    type: "article",
    image: { url: guide.cover, alt: `Tokokino editor: ${guide.title}` },
    publishedTime,
    modifiedTime: publishedTime,
    authors: guide.authors.map((author) => author.name),
    keywords: [guide.category, "Tokokino guide", "product screenshots"],
  })
}

const frameIllustrations: Record<string, number> = {
  "Canvas shape and device shape": 0,
  "Choose an aspect ratio": 1,
  "Prepare App Store screenshots": 2,
  "Phone mockups": 3,
  "Tablet mockups": 4,
  "Laptops and desktop displays": 5,
  "Apple Watch mockups": 6,
  "Browser and glass frames": 7,
  "Build a consistent set": 8,
  "Export at the right size": 9,
}

const captureIllustrations: Record<string, number> = {
  "Start from the page, not a file": 0,
  "Paste the link and pick a device": 1,
  "Give slow pages a few seconds": 2,
  "Work with the whole page, then narrow down": 3,
  "Style it like any other screenshot": 4,
  "Know what URL capture cannot do": 5,
}
const storyIllustrations: Record<string, number> = {
  "Why I built Tokokino": 6,
  "What can you make with it?": 7,
  "Backgrounds, textures, and colour": 8,
  "Style and trim a recording": 9,
  "Drafts, offline work, and sharing": 10,
  "How does Tokokino compare with other tools?": 11,
  "Bring in screenshots, websites, posts, or video": 0,
  "Frames, layout, and perspective": 1,
  "Text, annotations, and supporting layers": 2,
  "Animate a screenshot with keyframes": 3,
  "Templates, presets, and sets of canvases": 4,
  "Export a still image or motion file": 5,
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background ring-2 ring-background">
      {initials}
    </span>
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function extractHeadings(source: string): DocIndexItem[] {
  const items: DocIndexItem[] = []
  for (const line of source.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("## ")) {
      const label = trimmed.slice(3).trim()
      items.push({ id: slugify(label), label })
    } else if (trimmed.startsWith("### ")) {
      const label = trimmed.slice(4).trim()
      items.push({ id: slugify(label), label })
    }
  }
  return items
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) notFound()

  const related = getAllGuides()
    .filter((entry) => entry.slug !== guide.slug)
    .slice(0, 2)

  const headings = extractHeadings(guide.body)

  const SITE_URL = "https://tokokino.com"
  const guideUrl = `${SITE_URL}/guides/${guide.slug}`
  const publishedTime = new Date(guide.date + "T12:00:00Z").toISOString()

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${guideUrl}#article`,
        headline: guide.title,
        description: guide.excerpt,
        image: [guide.cover],
        url: guideUrl,
        datePublished: publishedTime,
        dateModified: publishedTime,
        author: guide.authors.map((author) => ({
          "@type": "Person",
          name: author.name,
        })),
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Tokokino",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": guideUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${guideUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Guides",
            item: `${SITE_URL}/guides`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: guide.title,
            item: guideUrl,
          },
        ],
      },
    ],
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
        <div className="flex items-center gap-1.5 px-5 py-3 sm:px-8 lg:px-12">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wide text-foreground/60 transition-colors hover:text-foreground"
          >
            <span
              aria-hidden
              className="inline-flex size-7 items-center justify-center rounded-full border border-primary/25 bg-primary/10"
            >
              <RiHomeLine className="size-3.5 text-primary" />
            </span>
            Guides
          </Link>
          <span aria-hidden className="text-[#9BCD64]">
            ›
          </span>
          <span className="font-mono text-[11px] tracking-wide text-foreground/60">
            {guide.category}
          </span>
        </div>
      </div>

      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-0">
          <div className="min-w-0 border-b border-border/50 xl:border-0">
            <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
              <div className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
                {formatGuideDate(guide.date)}
              </div>

              <h1 className="mt-3 max-w-3xl text-2xl leading-[1.18] font-medium tracking-tight sm:text-[30px] lg:text-[34px]">
                {guide.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="flex -space-x-1.5">
                  {guide.authors.map((author) => (
                    <Avatar key={author.name} name={author.name} />
                  ))}
                </span>
                <span className="text-sm text-foreground/70">
                  {guide.authors.map((author) => author.name).join(", ")}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-[11px] tracking-widest text-foreground/40 uppercase">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-flex size-6 items-center justify-center rounded-full border border-foreground/10"
                  >
                    <RiTimeLine className="size-3 text-foreground/40" />
                  </span>
                  {guide.readingTime} read
                </span>
                <CopyUrlButton />
              </div>

              <div className="mt-8 overflow-hidden rounded-md">
                <GuideCover
                  cover={guide.cover}
                  slug={guide.slug}
                  title={guide.title}
                  category={guide.category}
                />
              </div>

              <article className="mt-8 w-full min-w-0">
                {[
                  "meet-tokokino",
                  "capture-website-from-url",
                  "aspect-ratios-device-frames",
                ].includes(guide.slug) ? (
                  guide.body
                    .split(/(?=^## )/m)
                    .filter(Boolean)
                    .map((section, index) => {
                      const heading = section.split("\n")[0].replace(/^## /, "")
                      const artMap =
                        guide.slug === "aspect-ratios-device-frames"
                          ? frameIllustrations
                          : guide.slug === "meet-tokokino"
                            ? storyIllustrations
                            : captureIllustrations
                      const Art =
                        guide.slug === "aspect-ratios-device-frames"
                          ? FrameIllustration
                          : guide.slug === "meet-tokokino"
                            ? StoryIllustration
                            : CaptureIllustration
                      const artStep = artMap[heading]
                      return (
                        <section key={index}>
                          <Markdown source={section} />
                          {artStep !== undefined && <Art step={artStep} />}
                        </section>
                      )
                    })
                ) : (
                  <Markdown source={guide.body} />
                )}

                <div className="mt-10 flex flex-wrap gap-2 border-t border-border/50 pt-6">
                  <Link
                    href="/app"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95"
                  >
                    Try it in the editor
                  </Link>
                  <Link
                    href="/changelog"
                    className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground/70 transition hover:border-foreground/20 hover:text-foreground"
                  >
                    See what’s new
                  </Link>
                </div>
              </article>
            </div>
          </div>

          <aside className="hidden border-l border-border/50 xl:block">
            <div className="sticky top-8 px-6 py-8">
              <div className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
                On this page
              </div>
              {headings.length > 0 ? (
                <DocIndex items={headings} />
              ) : (
                <p className="mt-4 text-sm leading-6 text-foreground/50">
                  No sections in this guide.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <>
          <DashedH />
          <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
            <section className="px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
              <h2 className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                Keep reading
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {related.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/guides/${entry.slug}`}
                    className="group rounded-xl border border-border/60 p-5 transition hover:border-primary/20 hover:bg-card/50"
                  >
                    <div className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
                      {formatGuideDate(entry.date)} · {entry.category}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-[15px] leading-snug font-medium tracking-tight group-hover:text-primary">
                      {entry.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-foreground/58">
                      {entry.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Footer />
      </div>
      <SectionLinkHandler />
      <ScrollToTop />
    </main>
  )
}
