import {
  RiArticleLine,
  RiCursorLine,
  RiMegaphoneLine,
  RiPresentationLine,
  RiRocketLine,
  RiWindowLine,
} from "@remixicon/react"
import { motion } from "motion/react"
import { ease } from "@/components/landing/constants"

const USE_CASES = [
  {
    title: "Launch posts",
    body: "Turn a raw app capture or short motion sequence into a clean social card for X, Product Hunt, LinkedIn, or a changelog.",
    icon: RiRocketLine,
    meta: "16:9 / 1:1",
  },
  {
    title: "Product demo clips",
    body: "Animate zooms, tilts, lighting, backgrounds, and multi-shot transitions on a timeline for quick GIF/WebM demos.",
    icon: RiWindowLine,
    meta: "GIF / WebM",
  },
  {
    title: "Feature announcements",
    body: "Add arrows, labels, overlays, multi-shot layouts, and timeline beats when one image needs a little narrative.",
    icon: RiMegaphoneLine,
    meta: "Motion + labels",
  },
  {
    title: "Docs and guides",
    body: "Create readable UI stills or short walkthrough animations without dragging every asset through a design file.",
    icon: RiArticleLine,
    meta: "Stills / demos",
  },
] as const

const PIPELINE = [
  { label: "Capture", icon: RiCursorLine },
  { label: "Animate", icon: RiPresentationLine },
  { label: "Export", icon: RiRocketLine },
] as const

export function UseCasesSection() {
  return (
    <section
      id="use-cases"
      className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.65, ease }}
          className="flex flex-col gap-5"
        >
          <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
            {"// Use cases"}
          </span>
          <h2 className="max-w-xl text-2xl tracking-tight sm:text-3xl lg:text-4xl">
            Made for product visuals that need to move or ship fast.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-foreground/58">
            Tokokino keeps repeat visual work short: choose the right frame,
            apply a sharp backdrop, add context, animate the key moments, then
            export.
          </p>

          <div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-background/50 backdrop-blur-sm">
            {PIPELINE.map((step, index) => {
              const Icon = step.icon

              return (
                <div
                  key={step.label}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center border-b border-border/55 last:border-b-0"
                >
                  <div className="flex h-14 items-center justify-center border-r border-border/55 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="px-4 font-mono text-[10px] tracking-[0.24em] text-foreground/58 uppercase">
                    {step.label}
                  </div>
                  <div className="border-l border-border/55 px-4 text-right font-mono text-[10px] text-foreground/30">
                    0{index + 1}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2">
          {USE_CASES.map((item, index) => {
            const Icon = item.icon

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, ease, delay: index * 0.05 }}
                className="group rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm transition-colors hover:border-border/90"
              >
                <div className="flex min-h-[13rem] flex-col justify-between rounded-[8px] border border-border/40 bg-background/60 p-5 transition-colors group-hover:bg-background/80">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-background/70 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/36 uppercase">
                      {item.meta}
                    </span>
                  </div>
                  <div className="mt-8 flex flex-col gap-2">
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-foreground/52">
                      {item.body}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
