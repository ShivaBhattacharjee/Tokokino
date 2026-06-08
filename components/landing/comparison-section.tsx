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
      "The closest match — screenshots plus X and Bluesky posts. Polished, but a paid, closed-source cloud app.",
    tokokino:
      "The same screenshot + X/Bluesky workflow, free and open source, edited entirely in your browser.",
  },
  {
    competitor: "Pika",
    contrast:
      "A great beautifier with URL capture and tweet shots — gated behind a $15/mo subscription.",
    tokokino:
      "The same beautify-and-export flow, plus Bluesky posts, with no subscription to ship.",
  },
  {
    competitor: "Shots.so",
    contrast:
      "Beautiful device mockups, layouts, and animations — but no social-post mockups, and it's paid.",
    tokokino:
      "Device frames and layouts too, plus X and Bluesky posts, free and local-first.",
  },
] as const

const FEATURE_MATRIX = [
  {
    feature: "Free, no-watermark export",
    tokokino: true,
    postspark: "paid",
    pika: "paid",
    shots: "limited",
  },
  {
    feature: "Edit 100MB+ images lag-free",
    tokokino: true,
    postspark: "limited",
    pika: false,
    shots: false,
  },
  {
    feature: "Open source",
    tokokino: true,
    postspark: false,
    pika: true,
    shots: false,
  },
  {
    feature: "Edits stay in your browser",
    tokokino: true,
    postspark: "cloud",
    pika: "cloud",
    shots: "cloud",
  },
  {
    feature: "No account to export",
    tokokino: true,
    postspark: false,
    pika: false,
    shots: false,
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
    feature: "Capture from URL",
    tokokino: true,
    postspark: true,
    pika: true,
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
    feature: "4K / 8K export",
    tokokino: true,
    postspark: "paid",
    pika: "paid",
    shots: "paid",
  },
  {
    feature: "Multi-screenshot layouts",
    tokokino: true,
    postspark: true,
    pika: false,
    shots: true,
  },
  {
    feature: "Annotations & arrows",
    tokokino: true,
    postspark: true,
    pika: "limited",
    shots: "limited",
  },
] as const

type MatrixValue = boolean | "limited" | "paid" | "cloud"

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
    <span className="inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-foreground/45 uppercase">
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
          Everything the paid beautifiers do — free and open source.
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-foreground/58">
          Tokokino covers the same ground as PostSpark, Pika, and Shots — and
          adds X and Bluesky post mockups — with no subscription, no watermark,
          and nothing uploaded until you choose to share. It even stays smooth
          dragging and editing 100MB+ screenshots that other tools won&apos;t
          load.
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
