"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { RiGithubFill } from "@remixicon/react"
import { ArrowRight } from "@/components/landing/landing-svgs"
import { ease } from "@/components/landing/constants"

const asciiOrnaments = [
  {
    className: "left-[4%] top-[12%] text-foreground/35",
    text: [
      "      n",
      "     nnn",
      "    nnnnn",
      "nnnnnnnnnnn",
      "  nnnnnnn",
      "    nnn",
      "     n",
    ].join("\n"),
  },
  {
    className: "right-[7%] top-[16%] text-foreground/35",
    text: [
      "      oo",
      "     oooo",
      "oooo ooooo",
      " ooooooooo",
      "   ooooo",
      "  ooo ooo",
      " oo     oo",
    ].join("\n"),
  },
  {
    className: "bottom-[10%] left-[18%] hidden text-foreground/28 sm:block",
    text: [
      "  /\\",
      " /nn\\",
      "/nnnn\\",
      "\\nnnn/",
      " \\nn/",
      "  \\/",
    ].join("\n"),
  },
  {
    className: "bottom-[12%] right-[18%] hidden text-foreground/30 md:block",
    text: [
      "+++++",
      "+   +",
      "++ ++",
      " +++",
      "++ ++",
      "+   +",
      "+++++",
    ].join("\n"),
  },
]

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-65"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--foreground) 7%, transparent), transparent 36%), radial-gradient(circle at 18% 78%, color-mix(in oklch, var(--foreground) 5%, transparent), transparent 26%)",
        }}
      />

      {asciiOrnaments.map((ornament, index) => (
        <motion.pre
          aria-hidden="true"
          key={index}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: index * 0.07, ease }}
          className={`pointer-events-none absolute font-mono text-[9px] leading-[0.82] font-bold tracking-[-0.08em] select-none sm:text-[11px] md:text-[13px] ${ornament.className}`}
        >
          {ornament.text}
        </motion.pre>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.65, ease }}
        className="relative mx-auto flex max-w-5xl flex-col items-center text-center"
      >
        <span className="font-mono text-[10px] tracking-[0.28em] text-primary/80 uppercase">{"// Last call"}</span>
        <h2 className="mt-5 text-[1.65rem] leading-[1.05] font-medium tracking-[-0.04em] text-balance sm:text-4xl lg:text-[3.75rem]">
          Screenshot and mockup
          <br />
          <span className="text-primary">polish that ships.</span>
        </h2>
        <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-balance text-foreground/58 sm:text-[15px]">
          Create professional screenshot and device-mockup visuals with clean framing, balanced styling, and export-ready output.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_14px_40px_-18px_var(--primary)] transition hover:opacity-95"
          >
            Start editing
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://github.com/ShivaBhattacharjee/noctivy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/45 px-5 py-2.5 text-sm font-medium text-foreground/70 backdrop-blur-sm transition hover:border-foreground/30 hover:text-foreground"
          >
            <RiGithubFill className="size-4" />
            View source
          </a>
        </div>
      </motion.div>
    </section>
  )
}
