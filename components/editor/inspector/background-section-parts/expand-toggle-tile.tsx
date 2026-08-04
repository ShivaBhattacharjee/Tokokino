"use client"

import * as React from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react"
import { motion } from "motion/react"

import { TILE_FADE_VARIANTS } from "./constants"

export function ExpandToggleTile({
  expanded,
  onToggle,
  hiddenCount,
  peekStyle,
  title,
  animate = true,
}: {
  expanded: boolean
  onToggle: () => void
  hiddenCount: number
  peekStyle?: React.CSSProperties
  title: string
  animate?: boolean
}) {
  const Icon = expanded ? RiArrowUpSLine : RiArrowDownSLine

  return (
    <motion.button
      variants={animate ? TILE_FADE_VARIANTS : undefined}
      onClick={onToggle}
      title={title}
      aria-expanded={expanded}
      className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-secondary/40 transition-colors hover:border-foreground/30"
    >
      {peekStyle ? (
        <span
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center blur-sm"
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
