"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { BACKGROUND_LIBRARY, type BackgroundEntry } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import {
  backgroundCategoryIcon,
  BACKGROUND_PREVIEW_COUNT,
  EXPAND_EASE,
  TILE_FADE_VARIANTS,
  TILE_GRID_VARIANTS,
  TILE_ITEM_VARIANTS,
} from "./constants"
import { ExpandToggleTile } from "./expand-toggle-tile"

function BackgroundTile({
  item,
  active,
  onClick,
  layoutId,
  animate = true,
  fade = false,
}: {
  item: BackgroundEntry
  active: boolean
  onClick: () => void
  layoutId: string
  animate?: boolean
  fade?: boolean
}) {
  const tile = (
    <>
      <button
        onClick={onClick}
        title={item.name}
        className={cn(
          "block aspect-video w-full cursor-pointer overflow-hidden rounded-lg border transition-colors",
          active
            ? "border-transparent"
            : "border-border/60 hover:border-foreground/30"
        )}
      >
        <span
          aria-hidden
          className="block size-full bg-cover bg-center"
          style={{ backgroundImage: `url("${item.thumb}")` }}
        />
      </button>
      {active ? (
        animate ? (
          <motion.span
            layoutId={layoutId}
            className="pointer-events-none absolute -inset-0.5 rounded-[9px] ring-1 ring-primary/50"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        ) : (
          <span className="pointer-events-none absolute -inset-0.5 rounded-[9px] ring-1 ring-primary/50" />
        )
      ) : null}
    </>
  )

  // On mobile we render tiles statically (no entrance variants / layout
  // animation) to avoid jank on expand.
  if (!animate) return <div className="relative">{tile}</div>
  return (
    <motion.div
      variants={fade ? TILE_FADE_VARIANTS : TILE_ITEM_VARIANTS}
      className="relative"
    >
      {tile}
    </motion.div>
  )
}

export function BackgroundLibrary({
  activeSourceUrl,
  onSelect,
  flat = false,
}: {
  activeSourceUrl: string | null
  onSelect: (value: string, thumb?: string, preview?: string) => void
  flat?: boolean
}) {
  const categories = BACKGROUND_LIBRARY
  const [activeKey, setActiveKey] = React.useState<string>(() => {
    const found = categories.find((c) =>
      c.items.some((item) => item.full === activeSourceUrl)
    )
    return found?.key ?? categories[0]?.key ?? ""
  })
  const [expanded, setExpanded] = React.useState(false)

  const category = categories.find((c) => c.key === activeKey) ?? categories[0]

  if (!category) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
        No backgrounds available. Run <code>pnpm build:backgrounds</code>.
      </p>
    )
  }

  const items = category.items
  const head = items.slice(0, BACKGROUND_PREVIEW_COUNT)
  const hidden = items.slice(BACKGROUND_PREVIEW_COUNT)
  const peek = hidden[0] ?? null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary/40 p-1">
        {categories.map((c) => {
          const active = c.key === category.key
          const CategoryIcon = backgroundCategoryIcon(c.key)
          return (
            <button
              key={c.key}
              onClick={() => {
                setActiveKey(c.key)
                setExpanded(false)
              }}
              className={cn(
                "relative flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[5px] px-3 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="bg-category-pill"
                  className="absolute inset-0 rounded-[5px] bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : null}
              <CategoryIcon className="relative z-10 size-3.5 shrink-0" />
              <span className="relative z-10">{c.label}</span>
            </button>
          )
        })}
      </div>

      <motion.div
        // On mobile (flat) the panel itself scrolls; animating this container's
        // height makes the box grow before the tiles fill it, flashing white.
        // Skip the height animation there and let the grid swap in instantly.
        layout={!flat}
        transition={{ layout: { duration: 0.26, ease: EXPAND_EASE } }}
        className="relative w-full"
      >
        {(() => {
          const renderTile = (item: BackgroundEntry, fade = false) => (
            <BackgroundTile
              key={item.id}
              item={item}
              active={activeSourceUrl === item.full}
              onClick={() => onSelect(item.full, item.thumb, item.preview)}
              layoutId={`bg-tile-ring-${category.key}`}
              animate={!flat}
              fade={fade}
            />
          )

          // The toggle keeps its slot in the grid in both states, so expanding
          // reveals the rest after it instead of moving the control.
          const tiles = [
            ...head.map((item) => renderTile(item)),
            hidden.length > 0 ? (
              <ExpandToggleTile
                key="bg-expand-toggle"
                expanded={expanded}
                onToggle={() => setExpanded(!expanded)}
                hiddenCount={hidden.length}
                peekStyle={
                  peek ? { backgroundImage: `url("${peek.thumb}")` } : undefined
                }
                title={
                  expanded
                    ? `Show fewer ${category.label.toLowerCase()} backgrounds`
                    : `Show all ${items.length} ${category.label.toLowerCase()} backgrounds`
                }
                animate={!flat}
              />
            ) : null,
            ...(expanded ? hidden.map((item) => renderTile(item, true)) : []),
          ]

          // Mobile: render the grid statically — no entrance/exit animation,
          // no inner ScrollArea (the panel scrolls). Desktop keeps the animated
          // grid and the capped inner scroll.
          if (flat) {
            return (
              <div className="grid grid-cols-3 gap-2 px-1 py-1">{tiles}</div>
            )
          }

          // Keep the ScrollArea mounted in both states — remounting it on
          // expand would restart the whole grid's entrance animation instead of
          // just animating in the newly revealed tiles.
          return (
            <ScrollArea
              className={cn(
                expanded && "*:data-[slot=scroll-area-viewport]:max-h-70"
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`bg-${category.key}`}
                  variants={TILE_GRID_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="grid grid-cols-3 gap-2 px-1 py-1 pr-2"
                >
                  {tiles}
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
          )
        })()}
      </motion.div>
    </div>
  )
}
