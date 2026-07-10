"use client"

import * as React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { BACKGROUND_LIBRARY, type BackgroundEntry } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import {
  backgroundCategoryIcon,
  BACKGROUND_PREVIEW_COUNT,
  POP_EASE,
  TILE_GRID_VARIANTS,
  TILE_ITEM_VARIANTS,
} from "./constants"

function BackgroundTile({
  item,
  active,
  onClick,
  layoutId,
  animate = true,
}: {
  item: BackgroundEntry
  active: boolean
  onClick: () => void
  layoutId: string
  animate?: boolean
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
    <motion.div variants={TILE_ITEM_VARIANTS} className="relative">
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
  const visible = expanded ? items : items.slice(0, BACKGROUND_PREVIEW_COUNT)
  const hidden = items.slice(BACKGROUND_PREVIEW_COUNT)
  const peek = hidden[0] ?? null
  const showExpandTile = !expanded && hidden.length > 0

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
        transition={{ layout: { duration: 0.3, ease: POP_EASE } }}
        className="relative w-full"
      >
        {(() => {
          const tiles = visible.map((item) => (
            <BackgroundTile
              key={item.id}
              item={item}
              active={activeSourceUrl === item.full}
              onClick={() => onSelect(item.full, item.thumb, item.preview)}
              layoutId={`bg-tile-ring-${category.key}`}
              animate={!flat}
            />
          ))
          const expandTile =
            !expanded && showExpandTile ? (
              <motion.button
                variants={flat ? undefined : TILE_ITEM_VARIANTS}
                onClick={() => setExpanded(true)}
                title={`Show all ${items.length} ${category.label.toLowerCase()} backgrounds`}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-border/60 transition-colors hover:border-foreground/30"
              >
                {peek ? (
                  <span
                    aria-hidden
                    className="block size-full scale-110 bg-cover bg-center blur-sm"
                    style={{ backgroundImage: `url("${peek.thumb}")` }}
                  />
                ) : (
                  <div className="h-full w-full bg-secondary/40" />
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
                  <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  <span className="text-[9px] font-semibold">
                    +{hidden.length}
                  </span>
                </span>
              </motion.button>
            ) : null

          // Mobile: render the grid statically — no entrance/exit animation,
          // no inner ScrollArea (the panel scrolls). Desktop keeps the animated
          // grid and the capped inner scroll.
          if (flat) {
            return (
              <div className="grid grid-cols-3 gap-2 px-1 py-1">
                {tiles}
                {expandTile}
              </div>
            )
          }

          const animatedGrid = (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`bg-${expanded ? "expanded" : "collapsed"}-${category.key}`}
                variants={TILE_GRID_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="grid grid-cols-3 gap-2 px-1 py-1 pr-2"
              >
                {tiles}
                {expandTile}
              </motion.div>
            </AnimatePresence>
          )

          return expanded ? (
            <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[280px]">
              {animatedGrid}
            </ScrollArea>
          ) : (
            animatedGrid
          )
        })()}
      </motion.div>

      {expanded && flat ? (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Show less
        </button>
      ) : null}
      {expanded && !flat ? (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          onClick={() => setExpanded(false)}
          className="mt-2 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Show less
        </motion.button>
      ) : null}
    </div>
  )
}
