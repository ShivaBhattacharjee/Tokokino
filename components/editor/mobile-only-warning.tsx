"use client"

import * as React from "react"
import { motion } from "motion/react"
import { RiCheckLine, RiLinkM } from "@remixicon/react"

import { BrandLogo } from "@/components/editor/brand-logo"
import { cn } from "@/lib/utils"

const RECOMMENDED_MIN_PX = 1024

export function MobileOnlyWarning() {
  const [viewport, setViewport] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const update = () => setViewport(window.innerWidth)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const onCopyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open on a larger screen"
      className="fixed inset-0 z-[100] flex bg-background font-sans text-foreground md:hidden"
    >
      <Atmosphere />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-between px-5 py-7 text-foreground">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full justify-center"
        >
          <BrandLogo className="[&_span:last-child]:text-[13px] [&_svg]:text-primary [&>span:first-child]:size-9" />
        </motion.div>

        <div className="flex w-full max-w-[380px] flex-col items-center text-center">
          <Illustration />

          <motion.h1
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.35,
            }}
            className="mt-8 text-[30px] leading-[1.04] font-semibold text-balance text-foreground"
          >
            Open Tokokino on a wider screen
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.6 }}
            className="mt-4 max-w-[34ch] text-[13px] leading-6 text-muted-foreground"
          >
            The editor needs room for its canvas, sidebars, and floating tools.
            Continue on a tablet, laptop, or desktop for the full workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.85 }}
            className="mt-7 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => void onCopyLink()}
              className={cn(
                "group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-md border border-border bg-secondary/60 px-3 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors",
                "hover:border-primary/50 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 -left-12 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-foreground/10 to-transparent transition-transform duration-700 group-hover:translate-x-[260px]"
              />
              {copied ? (
                <RiCheckLine className="size-3.5 text-primary" />
              ) : (
                <RiLinkM className="size-3.5 text-muted-foreground" />
              )}
              {copied ? "Link copied" : "Copy link to open later"}
            </button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.05 }}
          className="flex flex-col items-center gap-2 font-mono text-[10px] text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <span className="tabular text-foreground/65">
              {viewport !== null ? `${viewport}px` : "—"}
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="tabular text-foreground/65">
              {RECOMMENDED_MIN_PX}px+ recommended
            </span>
          </div>
          <span className="tracking-[0.16em] uppercase">
            Made for big canvases
          </span>
        </motion.div>
      </div>
    </div>
  )
}

function Atmosphere() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,oklch(from_var(--foreground)_l_c_h_/_0.035)_1px,transparent_1px),linear-gradient(to_bottom,oklch(from_var(--foreground)_l_c_h_/_0.035)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_78%)] bg-size-[28px_28px]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 border-b border-border/50 bg-secondary/35"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-32 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.34 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_110%_75%_at_50%_35%,transparent_35%,oklch(from_var(--background)_l_c_h)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-8 bottom-24 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
    </div>
  )
}

const STARS: { cx: number; cy: number; r: number; delay: number }[] = [
  { cx: 30, cy: 34, r: 1.0, delay: 0 },
  { cx: 218, cy: 28, r: 1.2, delay: 0.4 },
  { cx: 28, cy: 132, r: 0.8, delay: 0.8 },
  { cx: 228, cy: 146, r: 1.0, delay: 1.1 },
  { cx: 64, cy: 18, r: 0.7, delay: 0.6 },
  { cx: 198, cy: 112, r: 0.8, delay: 1.4 },
]

function Illustration() {
  const crescentMaskId = React.useId()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 24,
        mass: 0.7,
        delay: 0.05,
      }}
      className="relative"
    >
      <svg
        viewBox="0 0 256 200"
        width="256"
        height="200"
        fill="none"
        aria-hidden="true"
        className="drop-shadow-[0_24px_50px_oklch(from_var(--foreground)_l_c_h_/_0.16)]"
      >
        <defs>
          <linearGradient id="screen-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0 0)" />
            <stop offset="100%" stopColor="oklch(0.13 0 0)" />
          </linearGradient>
          <linearGradient id="frame-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0 / 0.18)" />
            <stop offset="100%" stopColor="oklch(1 0 0 / 0.06)" />
          </linearGradient>
          <mask id={crescentMaskId}>
            <rect width="100%" height="100%" fill="black" />
            <rect x="99" y="70" width="48" height="48" rx="14" fill="white" />
            <circle cx="137" cy="78" r="16" fill="black" />
          </mask>
        </defs>

        {STARS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="oklch(1 0 0 / 0.55)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.65, 0.1] }}
            transition={{
              duration: 2.8 + (i % 3) * 0.6,
              ease: "easeInOut",
              repeat: Infinity,
              delay: s.delay,
            }}
          />
        ))}

        <motion.g
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          <rect
            x="34"
            y="36"
            width="188"
            height="116"
            rx="10"
            fill="url(#screen-grad)"
            stroke="url(#frame-grad)"
            strokeWidth="1.2"
          />
          <rect
            x="44"
            y="48"
            width="122"
            height="92"
            rx="7"
            fill="oklch(0.1 0 0)"
            stroke="oklch(1 0 0 / 0.06)"
          />
          <rect
            x="176"
            y="48"
            width="36"
            height="92"
            rx="7"
            fill="oklch(0.18 0 0)"
            stroke="oklch(1 0 0 / 0.08)"
          />
          <rect
            x="184"
            y="60"
            width="20"
            height="4"
            rx="2"
            fill="oklch(1 0 0 / 0.14)"
          />
          <rect
            x="184"
            y="72"
            width="15"
            height="4"
            rx="2"
            fill="oklch(1 0 0 / 0.09)"
          />
          <rect
            x="184"
            y="84"
            width="18"
            height="4"
            rx="2"
            fill="oklch(1 0 0 / 0.09)"
          />
          <rect
            x="184"
            y="120"
            width="20"
            height="4"
            rx="2"
            fill="oklch(0.7 0.2 18 / 0.7)"
          />

          <rect
            x="44"
            y="48"
            width="122"
            height="92"
            mask={`url(#${crescentMaskId})`}
            fill="oklch(0.7 0.2 18)"
          />
          <motion.circle
            cx="150"
            cy="72"
            r="1.5"
            fill="oklch(0.92 0.08 145)"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              delay: 0.85,
            }}
          />

          <rect
            x="92"
            y="164"
            width="72"
            height="5"
            rx="2.5"
            fill="oklch(1 0 0 / 0.1)"
          />
          <rect
            x="116"
            y="152"
            width="24"
            height="12"
            rx="2"
            fill="oklch(1 0 0 / 0.12)"
          />
        </motion.g>

        <motion.g
          initial={{ x: -4, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.6 }}
          style={{
            transformOrigin: "210px 142px",
          }}
        >
          <g transform="translate(196 138)">
            <rect
              x="0"
              y="0"
              width="22"
              height="38"
              rx="4.5"
              fill="oklch(0.18 0 0)"
              stroke="oklch(1 0 0 / 0.12)"
              strokeWidth="1"
            />
            <rect
              x="2.5"
              y="3"
              width="17"
              height="32"
              rx="2.5"
              fill="oklch(0.13 0 0)"
            />
            <line
              x1="-6"
              y1="-6"
              x2="28"
              y2="44"
              stroke="oklch(0.78 0.22 18 / 0.85)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        </motion.g>
      </svg>
    </motion.div>
  )
}
