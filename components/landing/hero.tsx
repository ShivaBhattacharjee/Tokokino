import Link from "next/link"
import { motion, useMotionValue, useTransform, animate } from "motion/react"
import { useEffect } from "react"
import { ArrowRight, StarIcon } from "@/components/landing/landing-svgs"
import { ease } from "@/components/landing/constants"
import { MockupFrame } from "@/components/landing/mockup-frame"

function StarCount() {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v))

  useEffect(() => {
    const controls = animate(count, 120, { duration: 1, ease: "easeOut", delay: 0.2 })
    return controls.stop
  }, [count])

  return (
    <a
      href="https://github.com/ShivaBhattacharjee/noctivy"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1 font-mono text-[10px] tracking-widest uppercase backdrop-blur-sm transition hover:border-border"
    >
      <StarIcon className="size-3 text-yellow-400" />
      <span className="text-foreground/70">
        <motion.span>{rounded}</motion.span>
        <span className="text-foreground/40"> stars on GitHub</span>
      </span>
    </a>
  )
}

export function Hero() {
  return (
    <section className="relative px-5 pt-14 pb-14 sm:px-8 sm:pt-20 sm:pb-20 lg:px-12 lg:pt-20 lg:pb-20">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="mx-auto flex w-full flex-col items-center gap-8 text-center"
      >
        <div className="flex max-w-5xl flex-col items-center text-center">
          <StarCount />

          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }} className="mt-3 text-[2.2rem] leading-[1.04] font-medium tracking-[-0.03em] text-balance sm:text-5xl lg:text-[4.2rem]">
            Make every screenshot
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">feel </span>
              <span className="text-primary">intentional .</span>
              <svg aria-hidden viewBox="0 0 320 12" className="absolute -bottom-3.5 left-[64%] h-3 w-[92%] -translate-x-1/2 text-primary" fill="none">
                <path d="M2 8 C 80 2, 240 2, 318 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "landing-draw 1.4s ease 0.9s forwards" }} />
              </svg>
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.3 }} className="mt-6 max-w-xl text-[14px] leading-relaxed text-balance text-foreground/60 sm:text-[15px]">
            Drop in a capture. Frame it, light it, share it — fully in the browser. No watermark, no upload, no compromise.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.4 }} className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95">
              Start editing
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/ShivaBhattacharjee/noctivy"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground/70 backdrop-blur-sm transition hover:border-accent-foreground/40 hover:text-foreground"
            >
              <StarIcon className="size-3.5 text-yellow-400" />
              Star on GitHub
            </a>
          </motion.div>

        </div>

        <div className="w-full max-w-6xl">
          <MockupFrame compact />
        </div>
      </motion.div>
    </section>
  )
}
