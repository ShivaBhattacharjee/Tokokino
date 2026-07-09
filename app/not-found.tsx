import Link from "next/link"
import type { CSSProperties } from "react"
import { RiHome5Line, RiImageEditLine, RiRouteLine } from "@remixicon/react"

import { DashedH } from "@/components/landing/dashed-h"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { Button } from "@/components/ui/button"
import { FlickeringGrid } from "@/components/ui/flickering-grid"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export default function NotFound() {
  return (
    <main
      className="relative isolate min-h-svh overflow-hidden bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <FlickeringGrid
          color="rgb(255,255,255)"
          maxOpacity={0.035}
          flickerChance={0.08}
          squareSize={3}
          gridGap={8}
          className="h-full w-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 24%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 30rem), radial-gradient(circle at 82% 70%, color-mix(in oklch, var(--accent-foreground) 22%, transparent), transparent 32rem)",
        }}
      />

      <DashedH />

      <section
        className={`relative z-10 ${CONTENT_WIDTH}`}
        style={RAIL_V_STYLE}
      >
        <div className="grid min-h-[calc(100svh-2px)] items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.72fr)] lg:px-12">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-1.5 font-mono text-[0.68rem] font-medium tracking-[0.16em] text-muted-foreground uppercase backdrop-blur">
              <RiRouteLine className="size-3.5 text-primary" />
              Lost route
            </div>

            <div className="space-y-5">
              <p className="font-mono text-[clamp(8rem,32vw,13rem)] leading-[0.78] font-semibold tracking-normal text-primary">
                404
              </p>
              <div className="mx-auto max-w-3xl space-y-4 lg:mx-0">
                <h1 className="text-[clamp(2.4rem,6vw,5.8rem)] leading-[0.95] font-semibold text-balance">
                  This frame is out of shot.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  The page you opened does not exist, moved, or was exported
                  from a route Tokokino no longer serves.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg" className="h-10 gap-2 px-4 text-sm">
                <Link href="/app">
                  <RiImageEditLine className="size-4" />
                  Open editor
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-10 gap-2 px-4 text-sm"
              >
                <Link href="/">
                  <RiHome5Line className="size-4" />
                  Go home
                </Link>
              </Button>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="relative hidden aspect-square min-h-96 overflow-hidden lg:block"
          >
            <div
              className="absolute inset-8 rounded-full blur-3xl"
              style={{
                background:
                  "conic-gradient(from 210deg at 50% 50%, color-mix(in oklch, var(--primary) 34%, transparent), transparent 28%, color-mix(in oklch, var(--accent-foreground) 30%, transparent), transparent 68%, color-mix(in oklch, var(--primary) 22%, transparent))",
              }}
            />
            <svg
              viewBox="0 0 560 560"
              className="absolute inset-0 h-full w-full text-foreground"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="not-found-frame"
                  x1="118"
                  y1="112"
                  x2="454"
                  y2="436"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="currentColor" stopOpacity="0.34" />
                  <stop
                    offset="1"
                    stopColor="currentColor"
                    stopOpacity="0.04"
                  />
                </linearGradient>
                <linearGradient
                  id="not-found-accent"
                  x1="176"
                  y1="166"
                  x2="432"
                  y2="382"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="var(--primary)" />
                  <stop offset="1" stopColor="var(--accent-foreground)" />
                </linearGradient>
                <filter
                  id="not-found-glow"
                  x="-40%"
                  y="-40%"
                  width="180%"
                  height="180%"
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur stdDeviation="14" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path
                d="M96 392 386 102"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="1"
                strokeDasharray="6 12"
              />
              <path
                d="M158 460 498 120"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1"
                strokeDasharray="6 12"
              />
              <rect
                x="142"
                y="132"
                width="288"
                height="220"
                rx="18"
                stroke="url(#not-found-frame)"
                strokeWidth="2"
                transform="rotate(-8 286 242)"
              />
              <rect
                x="188"
                y="194"
                width="288"
                height="220"
                rx="18"
                stroke="url(#not-found-frame)"
                strokeWidth="2"
                strokeDasharray="10 12"
                transform="rotate(8 332 304)"
              />
              <path
                d="M184 192c42 11 84 11 126 0"
                stroke="url(#not-found-accent)"
                strokeWidth="8"
                strokeLinecap="round"
                filter="url(#not-found-glow)"
                transform="rotate(-8 247 196)"
              />
              <path
                d="m192 328 74-82 46 50 34-36 72 78"
                stroke="url(#not-found-accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#not-found-glow)"
                transform="rotate(-8 305 292)"
              />
              <circle
                cx="392"
                cy="184"
                r="22"
                fill="var(--primary)"
                fillOpacity="0.2"
                stroke="var(--primary)"
                strokeOpacity="0.8"
                strokeWidth="2"
                filter="url(#not-found-glow)"
              />
              <path
                d="M254 428h112"
                stroke="currentColor"
                strokeOpacity="0.18"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M210 454h202"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="m448 270 24-24m-24 0 24 24"
                stroke="var(--primary)"
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#not-found-glow)"
              />
              <path
                d="m108 268 16-16m-16 0 16 16"
                stroke="var(--accent-foreground)"
                strokeOpacity="0.8"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      <DashedH />
    </main>
  )
}
