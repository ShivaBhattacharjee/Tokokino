import { RiCheckboxCircleLine, RiCloseCircleLine, RiSubtractLine } from "@remixicon/react"
import { motion } from "motion/react"
import { ease } from "@/components/landing/constants"

const COMPETITOR_COMPARISONS = [
  {
    competitor: "Figma",
    contrast: "Great when you need a full design file. Slow when you only need one polished screenshot.",
    tokokino: "Drop, frame, annotate, export, and move on.",
  },
  {
    competitor: "Canva",
    contrast: "Useful for social templates, but screenshot controls get buried inside generic design tools.",
    tokokino: "Built around device frames, canvas ratios, shadows, and product-shot export.",
  },
  {
    competitor: "CleanShot / Shottr",
    contrast: "Excellent capture tools. Styling usually stops at quick markup and simple backgrounds.",
    tokokino: "Turns existing captures into launch-ready visuals with layers and share links.",
  },
] as const

const FEATURE_MATRIX = [
  { feature: "Browser-only editing", tokokino: true, figma: false, canva: false },
  { feature: "No watermark exports", tokokino: true, figma: true, canva: false },
  { feature: "Device and browser frames", tokokino: true, figma: "manual", canva: "limited" },
  { feature: "Auto-sampled palettes", tokokino: true, figma: "plugin", canva: false },
  { feature: "Multi-screenshot layouts", tokokino: true, figma: "manual", canva: "manual" },
  { feature: "Local-first by default", tokokino: true, figma: false, canva: false },
] as const

type MatrixValue = boolean | "manual" | "limited" | "plugin"

function MatrixCell({ value, featured = false }: { value: MatrixValue; featured?: boolean }) {
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
    <section id="comparison" className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
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
          Faster than a design tool, sharper than a capture app.
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-foreground/58">
          Tokokino sits in the narrow space between screenshot utilities and full design suites: focused enough to be quick, flexible enough to ship polished product visuals.
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
        <div className="grid min-w-[38rem] grid-cols-[minmax(10rem,1.4fr)_repeat(3,minmax(4.5rem,0.55fr))] border-b border-border/60 bg-background/70 text-center font-mono text-[10px] tracking-[0.2em] text-foreground/42 uppercase">
          <div className="px-4 py-3 text-left">Feature</div>
          <div className="bg-primary/[0.07] px-3 py-3 text-primary">Tokokino</div>
          <div className="px-3 py-3">Figma</div>
          <div className="px-3 py-3">Canva</div>
        </div>

        {FEATURE_MATRIX.map((row) => (
          <div
            key={row.feature}
            className="grid min-w-[38rem] grid-cols-[minmax(10rem,1.4fr)_repeat(3,minmax(4.5rem,0.55fr))] border-b border-border/45 last:border-b-0"
          >
            <div className="px-4 py-3 text-[13px] font-medium text-foreground/78">
              {row.feature}
            </div>
            <div className="bg-primary/[0.045] px-3 py-3 text-center">
              <MatrixCell value={row.tokokino} featured />
            </div>
            <div className="px-3 py-3 text-center">
              <MatrixCell value={row.figma} />
            </div>
            <div className="px-3 py-3 text-center">
              <MatrixCell value={row.canva} />
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
