import type { Metadata } from "next"
import type { CSSProperties } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"

import { ChangelogIndex, type ChangelogIndexItem } from "./changelog-index"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata: Metadata = {
  title: "Changelog — Tokokino",
  description:
    "What shipped in each version of Tokokino — from the May 2026 launch through templates, motion, and offline editing in v2.",
  alternates: { canonical: "/changelog" },
}

type ChangeItem = {
  title: string
  text: string
}

type Release = {
  id: string
  version: string
  date: string
  title: string
  summary: string
  changes: ChangeItem[]
}

const releases: Release[] = [
  {
    id: "v2-2-0",
    version: "2.2.0",
    date: "August 14, 2026",
    title: "Glass frames & ASCII backdrops",
    summary:
      "Wrap shots in glass, a single pane or stacked layers, and turn any background into ASCII art. Plus ASCII Glass, a template that uses both.",
    changes: [
      {
        title: "Glass frames",
        text: "Glass Card is one pane. Glass Cascade stacks layers under the canvas. Glass Crown stacks them behind it. Each comes in dark and light.",
      },
      {
        title: "ASCII backdrops",
        text: "Turn any background into ASCII from Texture under Backdrop. Seven character sets, a resolution slider, and colour from the background or one you pick. Keyframe it in Animate mode.",
      },
      {
        title: "ASCII Glass template",
        text: "A ready-made look that pairs Glass Card with a blocks ASCII backdrop. Open it from Templates and drop your shot in.",
      },
      {
        title: "ASCII Crown template",
        text: "Glass Crown, blocks ASCII, and two 3D cones in the corners. Same Templates gallery as ASCII Glass.",
      },
      {
        title: "ASCII Cascade template",
        text: "Glass Cascade with full-opacity blocks ASCII on a fluid background. Open it from Templates.",
      },
      {
        title: "ASCII Number template",
        text: "No device frame, a grey border, and binary ASCII on a fluid background. Open it from Templates.",
      },
      {
        title: "Faster animation exports in Safari",
        text: "Safari recaptured the whole canvas for every frame of a video or GIF export, so a long clip could take a while. Layers that don't change from frame to frame are now reused, so the same export finishes faster and uses less memory.",
      },
    ],
  },
  {
    id: "v2-1-0",
    version: "2.1.0",
    date: "August 2, 2026",
    title: "3D shapes & new backgrounds",
    summary:
      "A library of 3D shapes you can drop straight onto your canvas — glass, chrome, holographic and more — and style them like any other layer. Plus three new background packs.",
    changes: [
      {
        title: "3D shapes library",
        text: "Browse 106 ready-made 3D shapes in the inspector and drop one onto the canvas with a click.",
      },
      {
        title: "Wood, Fluid & Minimal backgrounds",
        text: "Three new background packs in the inspector: warm wood grain, flowing colour, and clean minimal surfaces.",
      },
      {
        title: "More clouds",
        text: "The Cloud background pack grew from 7 to 28 images — sunsets, storm fronts, soft overcast and clear blue skies.",
      },
      {
        title: "Shapes behave like any other layer",
        text: "Move, resize, rotate, recolour, and reorder a shape exactly like an image you added yourself.",
      },
      {
        title: "Colour grade your screenshot or video",
        text: "Brightness, contrast, saturation, hue and the filter presets now work on the screenshot or video itself, not just the background. Open Effects or Filters under Backdrop and switch Apply to from Backdrop to Screenshot.",
      },
      {
        title: "Grade one screenshot or all of them",
        text: "With nothing selected a grade covers every screenshot on the canvas; select a single one first and it only changes that one.",
      },
      {
        title: "Animate the grade",
        text: "Screenshot and video grades are now keyframeable in Animate mode — fade a video from black and white into full colour, or ease brightness and saturation across a clip. Works on extra screenshots too, and carries through to video export.",
      },
      {
        title: "Keyframes stop restyling your canvas",
        text: "Leaving Animate mode used to leave the last keyframe's look painted onto the canvas, so a still export showed the end of the animation instead of your composition. The canvas now returns to where the animation starts.",
      },
      {
        title: "Grades and filters export correctly in Safari",
        text: "Video exports in Safari dropped every colour grade and filter preset from the finished file, even though the canvas showed them. They are now applied to the exported frames.",
      },
      {
        title: "Custom transition curves",
        text: "Pick Custom in the Animate transition menu and drag the two handles on the curve to shape exactly how a clip eases in and out, then set its speed in milliseconds.",
      },
      {
        title: "Border styles keep your settings",
        text: "Switching between border styles no longer resets the width and inner padding you set — a style now only changes the colour.",
      },
    ],
  },
  {
    id: "v2-0-0",
    version: "2.0.0",
    date: "July 25, 2026",
    title: "Templates, offline & motion",
    summary:
      "The big jump from v1. Start from ready-made templates, keep editing when you’re offline, and turn still shots into short product videos — with a timeline, GIF/video export, and smoother controls throughout.",
    changes: [
      {
        title: "Ready-made templates",
        text: "Open a template and drop your capture straight into a finished look.",
      },
      {
        title: "Animated templates",
        text: "Preview the motion before you apply it, then bring the same animation into your canvas.",
      },
      {
        title: "Showcase & homepage strip",
        text: "Browse templates on the showcase page or homepage strip and open one in the editor with a click.",
      },
      {
        title: "Offline editing",
        text: "Keep working when you’re offline — the app stays usable without a network connection.",
      },
      {
        title: "Animate mode",
        text: "Keyframe tilt, zoom, shadows, backgrounds, and more on a timeline built for product motion.",
      },
      {
        title: "Video & GIF on the canvas",
        text: "Drop video or GIF onto the canvas, then crop, mute, and scrub through a timeline.",
      },
      {
        title: "Export as GIF, WebM, or MP4",
        text: "Export animations in the format you need, including on Safari.",
      },
      {
        title: "Account settings",
        text: "Manage sessions and delete your account from a dedicated settings screen.",
      },
      {
        title: "Webpage capture & elastic sliders",
        text: "Capture a full webpage from a URL, search drafts, and use new elastic sliders in the inspector.",
      },
      {
        title: "Smoother presets & framing",
        text: "Live preset previews, rename and delete for projects and presets, and cleaner multi-screenshot framing.",
      },
      {
        title: "Safari & playback fixes",
        text: "Video export on Safari, blur effects with device frames, and template playback glitches are fixed.",
      },
      {
        title: "Drafts with any video format",
        text: "Saving a project with a .mov or other non-MP4 video no longer fails — any video the editor accepts can be saved as a draft.",
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
        title: "X post mockups",
        text: "Turn an X (Twitter) link into an exportable post card with images, stats, quoted posts, themes, and fonts.",
      },
      {
        title: "Bluesky post mockups",
        text: "The same styling options for Bluesky posts — paste a link and export a clean card.",
      },
      {
        title: "Custom filenames & gradients",
        text: "Name your exports yourself, and pick from new mesh and aurora gradients.",
      },
      {
        title: "Easier layers on mobile",
        text: "A flatter layers panel and controls that are easier to use on phones.",
      },
      {
        title: "More automated tests",
        text: "Extra coverage so releases stay stable as the editor grows.",
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
        title: "Public site & editor",
        text: "The site and editor are online for everyone.",
      },
      {
        title: "Sign in with email or Google",
        text: "Create an account and pick up your work across devices.",
      },
      {
        title: "Share links",
        text: "Publish a finished image so anyone can view it from a public link.",
      },
      {
        title: "High-res export",
        text: "Export as PNG, JPEG, or WebP up to 8K, or copy straight to the clipboard.",
      },
      {
        title: "Frames, bulk edit & presets",
        text: "Phone, tablet, and laptop frames; multi-canvas bulk edit; layout and tilt presets.",
      },
      {
        title: "Cloud projects & presets",
        text: "Save projects to the cloud and reuse your own presets.",
      },
      {
        title: "Preview mode",
        text: "Flip through canvases with slide, fade, zoom, and flip transitions.",
      },
      {
        title: "Capture from a URL",
        text: "Pull a website into the editor from a link.",
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
        title: "Sign-in in the editor",
        text: "Log in and manage your account from the editor menu.",
      },
      {
        title: "Share a finished image",
        text: "Upload and link a finished image with the share button.",
      },
      {
        title: "Custom presets & local drafts",
        text: "Save custom presets and keep drafts on your device before you sign in.",
      },
      {
        title: "Export choices",
        text: "Pick format and resolution when you export.",
      },
      {
        title: "Landing page",
        text: "A public homepage with hero, features, and footer.",
      },
      {
        title: "Cloudflare hosting",
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
        title: "Device frames",
        text: "Wrap shots in frames for phones, tablets, desktops, and browsers.",
      },
      {
        title: "Multiple canvases",
        text: "Work on several canvases on one board, with zoom and alignment guides.",
      },
      {
        title: "Layout & tilt presets",
        text: "Apply tilt and multi-screenshot layouts in one click.",
      },
      {
        title: "Layers & portrait blur",
        text: "Layer opacity, blend modes, portrait blur, and backdrop patterns.",
      },
      {
        title: "Clearer inspector",
        text: "Tighter top bar and clearer sections in the inspector.",
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
        title: "Canvas with undo & redo",
        text: "The first real editor canvas, with full undo and redo.",
      },
      {
        title: "Backgrounds & styling",
        text: "Backgrounds, overlays, shadows, borders, padding, and 3D tilt.",
      },
      {
        title: "Unsplash & crop",
        text: "Pull images from Unsplash and crop what you need.",
      },
      {
        title: "Text, stickers & annotations",
        text: "Add text, stickers, arrows, freehand marks, and enhance filters.",
      },
      {
        title: "Color picker & mobile layout",
        text: "Pick colors precisely, with a layout that works on phones.",
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
        title: "Repository foundation",
        text: "First commit and the beginnings of the editor.",
      },
    ],
  },
]

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

          <div className="mt-8 grid gap-10 sm:mt-10 md:grid-cols-[11rem_1fr] md:gap-8 lg:grid-cols-[13rem_1fr] lg:gap-12 xl:grid-cols-[14rem_1fr]">
            <aside className="hidden md:block">
              <ChangelogIndex items={indexItems} />
            </aside>

            <div className="min-w-0 space-y-14">
              {releases.map((release) => (
                <section
                  key={release.id}
                  id={release.id}
                  className="scroll-mt-8 border-t border-border/50 pt-10 max-sm:first:border-t-0 max-sm:first:pt-0"
                >
                  <header className="max-w-2xl space-y-3">
                    <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                      {release.date}
                    </span>
                    <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                      {release.title}
                    </h2>
                    <p className="text-sm leading-7 text-foreground/58 sm:text-[15px]">
                      <span className="font-mono text-primary/80 tabular-nums">
                        v{release.version}
                      </span>
                      <span className="text-foreground/30"> · </span>
                      {release.summary}
                    </p>
                  </header>

                  <ul className="mt-10 max-w-2xl space-y-8">
                    {release.changes.map((change, index) => (
                      <li key={`${release.id}-${index}`} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-primary"
                        />
                        <div className="min-w-0 space-y-1.5">
                          <h3 className="text-[15px] font-medium tracking-tight text-foreground sm:text-base">
                            {change.title}
                          </h3>
                          <p className="text-sm leading-7 text-foreground/58">
                            {change.text}
                          </p>
                        </div>
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
