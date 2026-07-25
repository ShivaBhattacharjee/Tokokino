import type { Metadata } from "next"
import type { CSSProperties, ReactNode } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { cn } from "@/lib/utils"

import { ChangelogIndex, type ChangelogIndexItem } from "./changelog-index"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata: Metadata = {
  title: "Changelog — Tokokino",
  description:
    "What shipped in each version of Tokokino — from the May 2026 launch through templates, motion, and offline editing in v2.",
  alternates: { canonical: "/changelog" },
}

type ChangeKind = "added" | "improved" | "fixed" | "infra"

type ChangeItem = {
  kind: ChangeKind
  text: ReactNode
}

type Release = {
  id: string
  version: string
  date: string
  title: string
  summary: string
  current?: boolean
  changes: ChangeItem[]
}

const releases: Release[] = [
  {
    id: "v2-0-0",
    version: "2.0.0",
    date: "July 25, 2026",
    title: "Templates, offline & motion",
    summary:
      "The big jump from v1. Start from ready-made templates, keep editing when you’re offline, and turn still shots into short product videos — with a timeline, GIF/video export, and smoother controls throughout.",
    current: true,
    changes: [
      {
        kind: "added",
        text: "Ready-made templates you can open and drop your capture into.",
      },
      {
        kind: "added",
        text: "Animated templates that preview the motion before you apply them.",
      },
      {
        kind: "added",
        text: "Showcase page and homepage template strip — click one to open it in the editor.",
      },
      {
        kind: "added",
        text: "Offline editing so the app keeps working without a network connection.",
      },
      {
        kind: "added",
        text: "Animate mode — a timeline to keyframe tilt, zoom, shadows, backgrounds, and more.",
      },
      {
        kind: "added",
        text: "Video and GIF on the canvas, with crop, mute, and a scrubbable timeline.",
      },
      {
        kind: "added",
        text: "Export animations as GIF, WebM, or MP4, including on Safari.",
      },
      {
        kind: "added",
        text: "Account settings to manage sessions and delete your account.",
      },
      {
        kind: "added",
        text: "Capture a full webpage from a URL; search drafts; new elastic sliders in the inspector.",
      },
      {
        kind: "improved",
        text: "Live preset previews, rename/delete for projects and presets, and cleaner multi-screenshot framing.",
      },
      {
        kind: "fixed",
        text: "Video export on Safari, blur effects with device frames, and template playback glitches.",
      },
      {
        kind: "fixed",
        text: "Saving a project with a .mov or other non-MP4 video no longer fails — any video the editor accepts can now be saved as a draft.",
      },
    ],
  },
  {
    id: "v1-1-0",
    version: "1.1.0",
    date: "June 2026",
    title: "Social post mockups",
    summary:
      "Paste an X or Bluesky link and get a clean, exportable post card. Better mobile editing and more gradient options.",
    changes: [
      {
        kind: "added",
        text: "X (Twitter) post mockups — images, stats, quoted posts, themes, and fonts.",
      },
      {
        kind: "added",
        text: "Bluesky post mockups with the same styling options.",
      },
      {
        kind: "added",
        text: "Custom export filenames and new mesh / aurora gradients.",
      },
      {
        kind: "added",
        text: "Flatter layers panel and easier controls on phones.",
      },
      {
        kind: "improved",
        text: "More automated tests so releases stay stable.",
      },
    ],
  },
  {
    id: "v1-0-0",
    version: "1.0.0",
    date: "May 22, 2026",
    title: "Public launch",
    summary:
      "Tokokino goes live. Sign in, style screenshots with frames and presets, export in high resolution, and share a public link — all from the browser.",
    changes: [
      {
        kind: "added",
        text: "Public site and editor online for everyone.",
      },
      {
        kind: "added",
        text: "Sign in with email or Google.",
      },
      {
        kind: "added",
        text: "Share links so anyone can view your finished image.",
      },
      {
        kind: "added",
        text: "Export as PNG, JPEG, or WebP up to 8K, or copy to the clipboard.",
      },
      {
        kind: "added",
        text: "Phone, tablet, and laptop frames; multi-canvas bulk edit; layout and tilt presets.",
      },
      {
        kind: "added",
        text: "Save projects to the cloud and reuse your own presets.",
      },
      {
        kind: "added",
        text: "Preview mode with slide, fade, zoom, and flip transitions.",
      },
      {
        kind: "added",
        text: "Capture a website from a URL into the editor.",
      },
    ],
  },
  {
    id: "v0-5-0",
    version: "0.5.0",
    date: "May 16 – 21, 2026",
    title: "Accounts, sharing & going live",
    summary:
      "The week before launch: logins, share uploads, cloud presets, a real landing page, and the move to Cloudflare hosting.",
    changes: [
      {
        kind: "added",
        text: "Sign-in and account menu in the editor.",
      },
      {
        kind: "added",
        text: "Share button to upload and link a finished image.",
      },
      {
        kind: "added",
        text: "Save custom presets and keep drafts on your device before you sign in.",
      },
      {
        kind: "added",
        text: "Export with format and resolution choices.",
      },
      {
        kind: "added",
        text: "Landing page with hero, features, and footer.",
      },
      {
        kind: "infra",
        text: "Moved hosting to Cloudflare and renamed the project to Tokokino.",
      },
    ],
  },
  {
    id: "v0-2-0",
    version: "0.2.0",
    date: "May 6 – 15, 2026",
    title: "Device frames & multi-canvas",
    summary:
      "Wrap shots in real device frames, work on several canvases at once, and apply layout presets in one click.",
    changes: [
      {
        kind: "added",
        text: "Device frames for phones, tablets, desktops, and browsers.",
      },
      {
        kind: "added",
        text: "Multiple canvases on one board, with zoom and alignment guides.",
      },
      {
        kind: "added",
        text: "Tilt and multi-screenshot layout presets.",
      },
      {
        kind: "added",
        text: "Layer opacity, blend modes, portrait blur, and backdrop patterns.",
      },
      {
        kind: "improved",
        text: "Clearer inspector sections and a tighter top bar.",
      },
    ],
  },
  {
    id: "v0-1-0",
    version: "0.1.0",
    date: "April 24 – May 5, 2026",
    title: "Core editor",
    summary:
      "The first real editor: drop in a screenshot, pick a background, add text and marks, crop, and undo mistakes.",
    changes: [
      {
        kind: "added",
        text: "Canvas editor with undo and redo.",
      },
      {
        kind: "added",
        text: "Backgrounds, overlays, shadows, borders, padding, and 3D tilt.",
      },
      {
        kind: "added",
        text: "Unsplash images and crop tools.",
      },
      {
        kind: "added",
        text: "Text, stickers, arrows, freehand annotations, and enhance filters.",
      },
      {
        kind: "added",
        text: "Color picker and a mobile-friendly layout.",
      },
    ],
  },
  {
    id: "v0-0-1",
    version: "0.0.1",
    date: "April 24, 2026",
    title: "Start",
    summary: "First commit. The project begins.",
    changes: [
      {
        kind: "added",
        text: "Repository and first editor foundation.",
      },
    ],
  },
]

const KIND_LABEL: Record<ChangeKind, string> = {
  added: "New",
  improved: "Improved",
  fixed: "Fixed",
  infra: "Setup",
}

const KIND_CLASS: Record<ChangeKind, string> = {
  added:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  improved: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  fixed:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400",
  infra:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
}

const badgeBase =
  "inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-medium tracking-wide uppercase"

export default function ChangelogPage() {
  const indexItems: ChangelogIndexItem[] = releases.map((release) => ({
    id: release.id,
    label: `v${release.version}`,
  }))

  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
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
              {"// Releases"}
            </span>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              Changelog
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              What shipped in each version of Tokokino.
            </p>
          </div>

          <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[13rem_1fr] lg:gap-12 xl:grid-cols-[14rem_1fr]">
            <aside className="hidden lg:block">
              <ChangelogIndex items={indexItems} />
            </aside>

            <div className="min-w-0 space-y-10">
              <nav
                aria-label="Release jump list"
                className="flex flex-wrap gap-2 lg:hidden"
              >
                {indexItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="rounded-md border border-primary/25 px-2.5 py-1 font-mono text-[11px] text-primary/70 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              {releases.map((release) => (
                <section
                  key={release.id}
                  id={release.id}
                  className="scroll-mt-8 border-t border-border/50 pt-8"
                >
                  <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                        {release.date}
                      </span>
                      {release.current ? (
                        <span
                          className={cn(
                            badgeBase,
                            "border-primary/40 bg-primary/10 text-primary"
                          )}
                        >
                          Current
                        </span>
                      ) : null}
                      {release.version === "1.0.0" ? (
                        <span
                          className={cn(
                            badgeBase,
                            "border-primary/30 bg-primary/5 text-primary/90"
                          )}
                        >
                          Launch
                        </span>
                      ) : null}
                    </div>
                    <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-medium tracking-tight sm:text-2xl">
                      <span className="font-mono text-primary tabular-nums">
                        v{release.version}
                      </span>
                      <span className="text-base font-medium tracking-tight text-foreground/90 sm:text-lg">
                        {release.title}
                      </span>
                    </h2>
                    <p className="max-w-2xl text-sm leading-7 text-foreground/58">
                      {release.summary}
                    </p>
                  </header>

                  <ul className="mt-6 space-y-4">
                    {release.changes.map((change, index) => (
                      <li
                        key={`${release.id}-${index}`}
                        className="flex flex-col gap-1.5 text-sm leading-6 sm:flex-row sm:items-start sm:gap-3"
                      >
                        <span
                          className={cn(
                            badgeBase,
                            "w-fit sm:mt-0.5 sm:min-w-[5.25rem]",
                            KIND_CLASS[change.kind]
                          )}
                        >
                          {KIND_LABEL[change.kind]}
                        </span>
                        <span className="min-w-0 text-foreground/58">
                          {change.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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
