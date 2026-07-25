import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  COMPARISONS,
  COMPARISONS_CHECKED_AT,
  getComparison,
  otherComparisons,
} from "@/lib/compare/comparisons"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export function generateStaticParams() {
  return COMPARISONS.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const comparison = getComparison(slug)

  if (!comparison) return {}

  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    alternates: { canonical: `/compare/${comparison.slug}` },
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      url: `/compare/${comparison.slug}`,
      type: "article",
    },
  }
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const comparison = getComparison(slug)

  if (!comparison) notFound()

  const others = otherComparisons(slug)
  const heading = `Tokokino vs ${comparison.competitor}`

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
        <article className="relative px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <Breadcrumb className="mb-6">
            <BreadcrumbList className="gap-1.5 font-mono text-[10px] tracking-widest text-foreground/42 uppercase">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-foreground">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-foreground">
                  <Link href="/compare">Compare</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground/42">
                  {comparison.competitor}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {"// Comparison"}
            </span>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              {comparison.eyebrow}
            </p>
          </div>

          <div className="mt-8 max-w-2xl space-y-5 sm:mt-10">
            {comparison.intro.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="text-sm leading-7 text-foreground/58"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <section id="key-differences" className="mt-12 scroll-mt-8 sm:mt-16">
            <h2 className="text-lg font-medium tracking-tight sm:text-xl">
              Key differences
            </h2>

            <div className="mt-5 overflow-hidden rounded-md border border-border/70 bg-background/55">
              <div className="hidden grid-cols-[minmax(9rem,0.85fr)_1fr_1fr] border-b border-border/60 bg-background/70 font-mono text-[10px] tracking-[0.2em] text-foreground/42 uppercase md:grid">
                <div className="px-4 py-3">Feature</div>
                <div className="bg-primary/[0.07] px-4 py-3 text-primary">
                  Tokokino
                </div>
                <div className="px-4 py-3">{comparison.competitor}</div>
              </div>

              {comparison.rows.map((row) => (
                <div
                  key={row.feature}
                  className="grid border-b border-border/45 last:border-b-0 md:grid-cols-[minmax(9rem,0.85fr)_1fr_1fr]"
                >
                  <div className="px-4 pt-4 pb-2 text-[13px] font-medium text-foreground/78 md:py-4">
                    {row.feature}
                  </div>
                  <div className="px-4 py-2 text-[13px] leading-6 text-foreground/72 md:bg-primary/4.5 md:py-4">
                    <span className="mr-1.5 font-mono text-[10px] tracking-widest text-primary uppercase md:hidden">
                      Tokokino
                    </span>
                    {row.tokokino}
                  </div>
                  <div className="px-4 pt-2 pb-4 text-[13px] leading-6 text-foreground/48 md:py-4">
                    <span className="mr-1.5 font-mono text-[10px] tracking-widest text-foreground/42 uppercase md:hidden">
                      {comparison.competitor}
                    </span>
                    {row.competitor}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 max-w-2xl text-xs leading-6 text-foreground/40">
              Plan names and limits on other products change often. Claims here
              were checked in {COMPARISONS_CHECKED_AT} against each
              product&rsquo;s public pages — check theirs before deciding.
            </p>
          </section>

          <section className="mt-12 sm:mt-16">
            <h2 className="text-lg font-medium tracking-tight sm:text-xl">
              Which one should you pick?
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
                <div className="h-full rounded-[8px] border border-border/40 bg-primary/5.5 p-5">
                  <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                    Use Tokokino if
                  </p>
                  <ul className="mt-4 space-y-3">
                    {comparison.pickTokokino.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-[13px] leading-6 text-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-2.5 size-1 shrink-0 rounded-full bg-primary"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
                <div className="h-full rounded-[8px] border border-border/40 bg-background/60 p-5">
                  <p className="font-mono text-[10px] tracking-[0.24em] text-foreground/36 uppercase">
                    Use {comparison.competitor} if
                  </p>
                  <ul className="mt-4 space-y-3">
                    {comparison.pickCompetitor.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-[13px] leading-6 text-foreground/54"
                      >
                        <span
                          aria-hidden
                          className="mt-2.5 size-1 shrink-0 rounded-full bg-foreground/28"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12 sm:mt-16">
            <h2 className="text-lg font-medium tracking-tight sm:text-xl">
              Other comparisons
            </h2>
            <ul className="mt-5 space-y-3">
              {others.map((entry) => (
                <li
                  key={entry.slug}
                  className="flex gap-2.5 text-sm leading-7 text-foreground/58"
                >
                  <span
                    aria-hidden
                    className="mt-3 size-1 shrink-0 rounded-full bg-foreground/28"
                  />
                  <span>
                    <Link
                      href={`/compare/${entry.slug}`}
                      className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                    >
                      Tokokino vs {entry.competitor}
                    </Link>{" "}
                    — {entry.summary}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm sm:mt-16">
            <div className="rounded-[8px] border border-border/40 bg-background/60 p-6 sm:p-8">
              <h2 className="text-lg font-medium tracking-tight sm:text-xl">
                Try it on your own screenshot
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-foreground/58">
                No account, no upload, no watermark. Drop a capture in and see
                what it looks like in about ten seconds.
              </p>
              <Link
                href="/app"
                className="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Open the editor
              </Link>
            </div>
          </section>
        </article>
      </div>

      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Footer />
      </div>
      <ScrollToTop />
    </main>
  )
}
