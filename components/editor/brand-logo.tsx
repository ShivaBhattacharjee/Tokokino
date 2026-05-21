"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const WORDMARK = "Tokokino"
const WORDMARK_CHARS = WORDMARK.split("")

const wordmarkContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.18 } },
}

const letterVariants = {
  hidden: { y: "60%", opacity: 0, filter: "blur(4px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 420, damping: 28, mass: 0.5 },
  },
}

export const BrandLogo = React.memo(function BrandLogo() {
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-0 select-none")} aria-label={WORDMARK}>
      <motion.span
        className="relative inline-flex shrink-0 -translate-y-px items-center justify-center"
        initial={{ opacity: 0, scale: 0.6, rotate: -16 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, mass: 0.6 }}
      >
        <Image src="/logo.png" alt={WORDMARK} width={48} height={48} className={cn("size-10 sm:size-12")} />
      </motion.span>

      <motion.span
        className={cn("font-mono text-[20px] leading-none font-medium tracking-[-0.02em] text-foreground")}
        initial="hidden"
        animate="visible"
        variants={wordmarkContainerVariants}
        aria-hidden="true"
      >
        {WORDMARK_CHARS.map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            className="inline-block"
            variants={letterVariants}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    </Link>
  )
})
