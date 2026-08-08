"use client"

import * as React from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

import { TILE_FADE_VARIANTS } from "./constants"

export function ExpandToggleTile({
  expanded,
  onToggle,
  hiddenCount,
  peekStyle,
  title,
  animate = true,
  aspect = "video",
  peekFit = "cover",
}: {
  expanded: boolean
  onToggle: () => void
  hiddenCount: number
  peekStyle?: React.CSSProperties
  title: string
  animate?: boolean
  /** Matches the shape of the tiles this toggle sits among. */
  aspect?: "video" | "square"
  peekFit?: "cover" | "contain"
}) {
  const Icon = expanded ? RiArrowUpSLine : RiArrowDownSLine

  return (
    <motion.button
      variants={animate ? TILE_FADE_VARIANTS : undefined}
      onClick={onToggle}
      title={title}
      aria-expanded={expanded}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-secondary/40 transition-colors hover:border-foreground/30",
        aspect === "square" ? "aspect-square" : "aspect-video"
      )}
    >
      {peekStyle ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 scale-110 bg-center bg-no-repeat blur-sm",
            peekFit === "contain" ? "bg-contain" : "bg-cover"
          )}
          style={peekStyle}
        />
      ) : null}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
        <Icon className="size-4" />
        {!expanded && hiddenCount > 0 ? (
          <span className="text-[9px] font-semibold">+{hiddenCount}</span>
        ) : null}
      </span>
    </motion.button>
  )
}
