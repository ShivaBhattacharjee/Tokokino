"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const WORDMARK = "Tokokino"

function TokokinoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="tokokino-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect x="4.5" y="4.5" width="23" height="23" rx="6" stroke="url(#tokokino-mark)" strokeOpacity="0.55" />
      <path d="M10 22V10h2.2l7.6 8V10H22v12h-2.2l-7.6-8v8H10Z" fill="currentColor" />
      <circle cx="22.5" cy="9.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex min-w-0 items-center gap-2 select-none", className)}
      aria-label={WORDMARK}
    >
      <motion.span
        className="relative inline-flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.6, rotate: -16 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, mass: 0.6 }}
      >
        <TokokinoMark className="size-5 text-primary" />
      </motion.span>

      <motion.span
        className="font-mono text-[14px] font-medium tracking-[-0.02em] text-foreground"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.045, delayChildren: 0.18 } },
        }}
        aria-hidden="true"
      >
        {WORDMARK.split("").map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            className="inline-block"
            variants={{
              hidden: { y: "60%", opacity: 0, filter: "blur(4px)" },
              visible: {
                y: 0,
                opacity: 1,
                filter: "blur(0px)",
                transition: { type: "spring", stiffness: 420, damping: 28, mass: 0.5 },
              },
            }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    </Link>
  )
}
