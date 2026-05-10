"use client"

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const WORDMARK = "Noctivy"

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-0 select-none", className)}
      aria-label={WORDMARK}
    >
      <motion.span
        className="relative inline-flex size-12 items-center justify-center"
        initial={{ opacity: 0, scale: 0.6, rotate: -16 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 22,
          mass: 0.6,
        }}
      >
        <LogoMark className="size-[18px] text-foreground" />
      </motion.span>

      <motion.span
        className="font-mono text-[14px] font-medium tracking-[-0.02em] text-foreground"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.045, delayChildren: 0.18 },
          },
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
                transition: {
                  type: "spring",
                  stiffness: 420,
                  damping: 28,
                  mass: 0.5,
                },
              },
            }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    </div>
  )
}

function LogoMark({ className }: { className?: string }) {
  const maskId = React.useId()
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect x="3" y="3" width="26" height="26" rx="8" fill="white" />
          <circle cx="22.5" cy="11" r="6.5" fill="black" />
        </mask>
      </defs>
      <motion.rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill="currentColor"
        mask={`url(#${maskId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
      />
      <motion.circle
        cx="24.5"
        cy="8.5"
        r="1.6"
        fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 18,
          delay: 0.45,
        }}
      />
    </svg>
  )
}
