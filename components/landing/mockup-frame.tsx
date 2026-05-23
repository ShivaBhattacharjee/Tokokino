import { motion } from "motion/react"
import { CornerTick } from "@/components/landing/landing-svgs"
import { ease } from "@/components/landing/constants"
import { ShimmerImage } from "@/components/ui/shimmer-image"

export function MockupFrame({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="mockup"
      className={
        compact ? "relative" : "relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease }}
        className={
          compact ? "relative mx-auto w-full" : "relative mx-auto max-w-[68rem]"
        }
      >
        <div className="relative rounded-[20px] border border-border/70 bg-background/40 p-2 backdrop-blur-md">
          <CornerTick className="absolute -top-1.5 -left-1.5 size-3 text-primary/70" />
          <CornerTick className="absolute -top-1.5 -right-1.5 size-3 rotate-90 text-accent-foreground/70" />
          <CornerTick className="absolute -bottom-1.5 -left-1.5 size-3 -rotate-90 text-accent-foreground/70" />
          <CornerTick className="absolute -right-1.5 -bottom-1.5 size-3 rotate-180 text-primary/70" />

          <div className="relative overflow-hidden rounded-[14px] border border-border/60 bg-gradient-to-b from-background/80 to-background/40">
            <div className="flex items-center justify-between border-b border-border/50 bg-background/40 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary/55" />
                <span className="size-2.5 rounded-full bg-accent-foreground/55" />
                <span className="size-2.5 rounded-full bg-foreground/15" />
              </div>
              <span className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
                tokokino
              </span>
              <span className="font-mono text-[10px] text-foreground/30">
                ⌘ K
              </span>
            </div>

            <div className="relative aspect-[16/10] w-full">
              <div className="absolute inset-0 [background-image:linear-gradient(to_right,oklch(0.7_0.2_18/0.05)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.82_0.14_145/0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_95%)]" />
              <div className="relative flex h-full w-full items-center justify-center bg-background/35 p-2 sm:p-3">
                <ShimmerImage
                  src={`https://assets.tokokino.com/screenshot.png`}
                  alt="Tokokino demo preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
