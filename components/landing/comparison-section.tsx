import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiSubtractLine,
} from "@remixicon/react"
import { motion } from "motion/react"
import { ease } from "@/components/landing/constants"

const COMPETITOR_COMPARISONS = [
  {
    competitor: "PostSpark",
    contrast:
      "Closest match for screenshots, X/Bluesky posts, and video mockups. Strong template library plus animation/zoom — but video mockups, deeper timeline motion, no-limits usage, and cloud storage sit behind PostSpark Pro.",
    tokokino:
      "Tokokino keeps the workflow lean: starter image + animation templates, local editing, free high-res stills, an editable keyframe timeline with GIF/WebM/MP4 export, free cloud drafts, and reusable presets without a subscription meter.",
  },
  {
    competitor: "Pika",
    contrast:
      "A polished browser editor with URL capture, tweet shots, and dozens of static mockup templates. It stays image-first — no keyframe timeline or GIF/WebM product demos — and 4K export, presets, annotations, WebP/SVG, and no watermark are Pro.",
    tokokino:
      "Tokokino covers the launch loop end-to-end: free starter templates (including animated reveals), 4K/8K stills, timeline animation, GIF/WebM/MP4 export, annotations, custom presets, and Bluesky post mockups in the free product.",
  },
  {
    competitor: "Shots.so",
    contrast:
      "Strong for device frames, magic backgrounds, and preset-based animated mockups / video zoom. Serious motion export (WebM, animation presets) is on paid tiers, templates are lighter, and there are no social-post mockups.",
    tokokino:
      "Tokokino is the editable-timeline lane: device + browser frames, multi-shot layouts, X/Bluesky posts, free animation templates, local-first editing, and timeline-driven scene changes you can export as GIF/WebM/MP4.",
  },
] as const

const FEATURE_MATRIX = [
  {
    feature: "Free no-watermark export",
    tokokino: true,
    postspark: "paid",
    pika: "paid",
    shots: "limited",
  },
  {
    feature: "4K / 8K static export",
    tokokino: true,
    postspark: "paid",
    pika: "paid",
    shots: "paid",
  },
  {
    feature: "Starter mockup templates",
    tokokino: true,
    postspark: true,
    pika: "limited",
    shots: "limited",
  },
  {
    feature: "Animation / video templates",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "paid",
  },
  {
    feature: "Editable motion timeline",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "presets",
  },
  {
    feature: "GIF / WebM / MP4 export",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "paid",
  },
  {
    feature: "Video mockups (drop recording)",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "paid",
  },
  {
    feature: "Zoom / animation presets",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "paid",
  },
  {
    feature: "Heavy screenshot workflow",
    tokokino: "100mb+",
    postspark: "limited",
    pika: "limited",
    shots: "limited",
  },
  {
    feature: "Open source",
    tokokino: true,
    postspark: false,
    pika: true,
    shots: false,
  },
  {
    feature: "Local-first editing",
    tokokino: true,
    postspark: "cloud",
    pika: "browser",
    shots: "cloud",
  },
  {
    feature: "Free cloud project drafts",
    tokokino: "1gb",
    postspark: "paid",
    pika: "not listed",
    shots: "not listed",
  },
  {
    feature: "Unlimited custom presets",
    tokokino: true,
    postspark: "not listed",
    pika: "paid",
    shots: "not listed",
  },
  {
    feature: "X (Twitter) post mockups",
    tokokino: true,
    postspark: true,
    pika: true,
    shots: false,
  },
  {
    feature: "Bluesky post mockups",
    tokokino: true,
    postspark: true,
    pika: false,
    shots: false,
  },
  {
    feature: "Quoted-post mockups",
    tokokino: true,
    postspark: true,
    pika: false,
    shots: false,
  },
  {
    feature: "Auto-sampled backgrounds",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: "magic",
  },
  {
    feature: "Multi-screenshot layouts",
    tokokino: true,
    postspark: true,
    pika: false,
    shots: true,
  },
  {
    feature: "Bulk edit multiple shots",
    tokokino: true,
    postspark: "paid",
    pika: false,
    shots: false,
  },
  {
    feature: "Annotations & arrows",
    tokokino: true,
    postspark: true,
    pika: "limited",
    shots: "limited",
  },
] as const

type MatrixValue =
  | boolean
  | "100mb+"
  | "1gb"
  | "browser"
  | "cloud"
  | "limited"
  | "magic"
  | "not listed"
  | "paid"
  | "presets"

function MatrixCell({
  value,
  featured = false,
}: {
  value: MatrixValue
  featured?: boolean
}) {
  if (value === true) {
    return (
      <span className={featured ? "text-primary" : "text-foreground/72"}>
        <RiCheckboxCircleLine className="mx-auto size-4" />
      </span>
    )
  }

  if (value === false) {
    return (
      <span className="text-foreground/28">
        <RiCloseCircleLine className="mx-auto size-4" />
      </span>
    )
  }

  return (
    <span
      className={
        featured
          ? "inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-primary uppercase"
          : "inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-foreground/45 uppercase"
      }
    >
      <RiSubtractLine className="size-3.5" />
      {value}
    </span>
  )
}

export function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65, ease }}
        className="mb-10 flex max-w-4xl flex-col gap-4"
      >
        <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
          {"// Comparison"}
        </span>
        <h2 className="max-w-3xl text-2xl tracking-tight sm:text-3xl lg:text-4xl">
          The product visual editor that does not turn every useful feature into
          a plan upgrade.
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-foreground/58">
          PostSpark, Pika, and Shots all make good-looking mockups. Tokokino is
          built for the part that should stay effortless: start from a template,
          drop a huge capture or screen recording, tune the layout, animate key
          moments on a timeline, save the project, reuse the preset, and export
          clean 4K/8K stills or GIF/WebM/MP4 motion without a watermark or
          subscription.
        </p>
      </motion.div>

      <div className="grid gap-3 lg:grid-cols-3">
        {COMPETITOR_COMPARISONS.map((item, index) => (
          <motion.div
            key={item.competitor}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease, delay: index * 0.05 }}
            className="rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm"
          >
            <div className="grid h-full overflow-hidden rounded-[8px] border border-border/40 bg-background/60">
              <div className="border-b border-border/50 p-5">
                <p className="font-mono text-[10px] tracking-[0.24em] text-foreground/36 uppercase">
                  Versus {item.competitor}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/54">
                  {item.contrast}
                </p>
              </div>
              <div className="bg-primary/5.5 p-5">
                <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                  Tokokino
                </p>
                <p className="mt-3 text-[14px] leading-relaxed font-medium text-foreground">
                  {item.tokokino}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, ease, delay: 0.08 }}
        className="mt-5 max-h-112 overflow-auto rounded-md border border-border/70 bg-background/55 backdrop-blur-md sm:max-h-none sm:overflow-visible"
      >
        <div className="grid min-w-152 grid-cols-[minmax(10rem,1.4fr)_repeat(4,minmax(4.5rem,0.55fr))] border-b border-border/60 bg-background/70 text-center font-mono text-[10px] tracking-[0.2em] text-foreground/42 uppercase">
          <div className="px-4 py-3 text-left">Feature</div>
          <div className="bg-primary/[0.07] px-3 py-3 text-primary">
            Tokokino
          </div>
          <div className="px-3 py-3">PostSpark</div>
          <div className="px-3 py-3">Pika</div>
          <div className="px-3 py-3">Shots.so</div>
        </div>

        {FEATURE_MATRIX.map((row) => (
          <div
            key={row.feature}
            className="grid min-w-152 grid-cols-[minmax(10rem,1.4fr)_repeat(4,minmax(4.5rem,0.55fr))] border-b border-border/45 last:border-b-0"
          >
            <div className="px-4 py-3 text-[13px] font-medium text-foreground/78">
              {row.feature}
            </div>
            <div className="bg-primary/4.5 px-3 py-3 text-center">
              <MatrixCell value={row.tokokino} featured />
            </div>
            <div className="px-3 py-3 text-center">
              <MatrixCell value={row.postspark} />
            </div>
            <div className="px-3 py-3 text-center">
              <MatrixCell value={row.pika} />
            </div>
            <div className="px-3 py-3 text-center">
              <MatrixCell value={row.shots} />
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
