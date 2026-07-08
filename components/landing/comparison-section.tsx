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
      "The closest match — screenshots plus X and Bluesky posts, with video and animation extras. Strong tool, but animation workflows, no-limits usage, and cloud storage sit behind paid upgrades.",
    tokokino:
      "Tokokino keeps the screenshot/post workflow lean: local editing, free high-res exports, GIF/WebM animation export, free cloud drafts, and reusable presets without a subscription meter.",
  },
  {
    competitor: "Pika",
    contrast:
      "A polished browser editor with URL capture, tweet shots, and templates. The catch: it is built around static assets — no timeline animation — and 4K export, presets, annotations, WebP/SVG, and no watermark are Pro features.",
    tokokino:
      "Tokokino gives the daily launch workflow room to breathe: 4K/8K export, animations, annotations, custom presets, and Bluesky post mockups are part of the free product.",
  },
  {
    competitor: "Shots.so",
    contrast:
      "Beautiful for animated device mockups and zoom videos, with the serious motion export workflow on paid tiers. It is focused on mockups and does not cover social-post mockups.",
    tokokino:
      "Tokokino is the lighter, faster lane for product motion and static shots: device frames, browser frames, multi-shot layouts, X/Bluesky posts, and local-first editing.",
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
    feature: "Timeline animation + GIF/WebM export",
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
    shots: false,
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
  | "not listed"
  | "paid"

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
          The screenshot editor that does not turn every useful feature into a
          plan upgrade.
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-foreground/58">
          PostSpark, Pika, and Shots all make good-looking mockups. Tokokino is
          built for the part that should stay effortless: drag a huge
          screenshot, tune the layout, animate the key moments, save the
          project, reuse the preset, and export clean 4K/8K images or GIF/WebM
          motion without a watermark or subscription.
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
              <div className="bg-primary/[0.055] p-5">
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
        className="mt-5 max-h-[28rem] overflow-auto rounded-md border border-border/70 bg-background/55 backdrop-blur-md sm:max-h-none sm:overflow-visible"
      >
        <div className="grid min-w-[38rem] grid-cols-[minmax(10rem,1.4fr)_repeat(4,minmax(4.5rem,0.55fr))] border-b border-border/60 bg-background/70 text-center font-mono text-[10px] tracking-[0.2em] text-foreground/42 uppercase">
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
            className="grid min-w-[38rem] grid-cols-[minmax(10rem,1.4fr)_repeat(4,minmax(4.5rem,0.55fr))] border-b border-border/45 last:border-b-0"
          >
            <div className="px-4 py-3 text-[13px] font-medium text-foreground/78">
              {row.feature}
            </div>
            <div className="bg-primary/[0.045] px-3 py-3 text-center">
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
