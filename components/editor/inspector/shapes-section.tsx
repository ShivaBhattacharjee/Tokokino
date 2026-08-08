"use client"

import * as React from "react"

import { SHAPE_LIBRARY } from "@/lib/editor/presets"
import type { ShapeEntry } from "@/lib/editor/state-types"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { ExpandToggleTile } from "./background-section-parts/expand-toggle-tile"

/** Shapes shown before the library is expanded (+1 grid slot for the toggle). */
const SHAPE_PREVIEW_COUNT = 8
const SHAPE_BATCH = 24
/** Distance from the bottom of the scroller that pulls in the next batch. */
const LOAD_MORE_MARGIN = 240

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return node
    node = node.parentElement
  }
  return null
}

function ShapeTile({
  shape,
  onClick,
}: {
  shape: ShapeEntry
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={`Add ${shape.name}`}
      className="block aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-border/60 bg-secondary/30 p-1 transition-colors hover:border-foreground/30"
    >
      <span
        aria-hidden
        className="block size-full bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${shape.thumb}")` }}
      />
    </button>
  )
}

export function ShapesSection({ flat = false }: { flat?: boolean } = {}) {
  const {
    addAsset,
    setSelectedAssetId,
    setSelectedTextId,
    setSelectedScreenshotSlotId,
    setIsScreenshotSelected,
    setActiveTool,
  } = useEditor()

  const wrapRef = React.useRef<HTMLDivElement>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const scrollRootRef = React.useRef<HTMLElement | null>(null)
  // How many shapes are rendered — and, at its floor, whether the section is
  // still collapsed. One value rather than two, so expanding and paging can't
  // disagree about what is on screen.
  const [count, setCount] = React.useState(SHAPE_PREVIEW_COUNT)
  const expanded = count > SHAPE_PREVIEW_COUNT
  // Height of the collapsed preview grid. Expanding scrolls the full library
  // inside exactly that box instead of pushing the rest of the inspector down.
  const [collapsedHeight, setCollapsedHeight] = React.useState<number | null>(
    null
  )

  React.useLayoutEffect(() => {
    if (expanded) return
    const grid = gridRef.current
    if (!grid) return
    const measure = () => {
      const h = grid.offsetHeight
      if (h > 0) setCollapsedHeight(h)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    // The tiles are square, so the grid's height follows the panel's width —
    // re-measure rather than freezing the height the section first opened at.
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [expanded])

  const loadMore = React.useCallback(() => {
    setCount((c) => Math.min(c + SHAPE_BATCH, SHAPE_LIBRARY.length))
  }, [])
  const showAll = React.useCallback(() => {
    setCount(SHAPE_LIBRARY.length)
  }, [])
  const toggleExpanded = React.useCallback(() => {
    setCount((c) =>
      c > SHAPE_PREVIEW_COUNT ? SHAPE_PREVIEW_COUNT : SHAPE_BATCH
    )
  }, [])

  // Collapsed, the section is a fixed preview grid — there is nothing to page
  // through, so the scroll listener and the top-up below only run once the user
  // has asked for the whole library.
  React.useEffect(() => {
    if (!expanded) {
      scrollRootRef.current = null
      return
    }
    // Flat mode scrolls in an ancestor panel rather than in our own box, so the
    // listener has to go on whichever element actually scrolls.
    const root = flat ? findScrollParent(wrapRef.current) : wrapRef.current
    scrollRootRef.current = root
    // Nothing scrolls, so no batch after this one could ever be reached.
    if (!root) {
      showAll()
      return
    }
    const onScroll = () => {
      if (
        root.scrollTop + root.clientHeight >=
        root.scrollHeight - LOAD_MORE_MARGIN
      ) {
        loadMore()
      }
    }
    root.addEventListener("scroll", onScroll, { passive: true })
    return () => root.removeEventListener("scroll", onScroll)
  }, [expanded, flat, loadMore, showAll])

  // A batch that doesn't overflow the scroller leaves nothing to scroll, so
  // the rest would be unreachable — keep topping up until it does.
  React.useEffect(() => {
    const root = scrollRootRef.current
    if (!expanded || !root || count >= SHAPE_LIBRARY.length) return
    if (root.scrollHeight <= root.clientHeight) loadMore()
  }, [count, expanded, loadMore])

  // Mirrors the toolbar's image-upload path so a shape behaves exactly like any
  // other asset once it lands on the canvas.
  const handleAdd = React.useCallback(
    (shape: ShapeEntry) => {
      const id = addAsset(shape.full)
      setSelectedAssetId(id)
      setSelectedTextId(null)
      setSelectedScreenshotSlotId(null)
      setIsScreenshotSelected(false)
      setActiveTool("pointer")
    },
    [
      addAsset,
      setSelectedAssetId,
      setSelectedTextId,
      setSelectedScreenshotSlotId,
      setIsScreenshotSelected,
      setActiveTool,
    ]
  )

  if (!SHAPE_LIBRARY.length) return null

  const head = SHAPE_LIBRARY.slice(0, SHAPE_PREVIEW_COUNT)
  const hiddenCount = SHAPE_LIBRARY.length - head.length
  const peek = SHAPE_LIBRARY[SHAPE_PREVIEW_COUNT] ?? null
  const shown = expanded ? SHAPE_LIBRARY.slice(0, count) : head

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] text-muted-foreground">
        Click a shape to drop it on the canvas.
      </p>
      <div
        ref={wrapRef}
        className={cn(
          "[contain:layout_paint]",
          !flat && expanded && "overflow-y-auto overscroll-contain"
        )}
        style={
          !flat && expanded && collapsedHeight
            ? { maxHeight: collapsedHeight }
            : undefined
        }
      >
        <div
          ref={gridRef}
          className={cn(
            "grid gap-2 px-1 py-1",
            flat ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          {head.map((shape) => (
            <ShapeTile
              key={shape.id}
              shape={shape}
              onClick={() => handleAdd(shape)}
            />
          ))}
          {/* The toggle keeps its slot in the grid in both states, so expanding
              reveals the rest after it instead of moving the control. */}
          {hiddenCount > 0 ? (
            <ExpandToggleTile
              expanded={expanded}
              onToggle={toggleExpanded}
              hiddenCount={hiddenCount}
              aspect="square"
              peekFit="contain"
              peekStyle={
                peek ? { backgroundImage: `url("${peek.thumb}")` } : undefined
              }
              title={
                expanded
                  ? "Show fewer shapes"
                  : `Show all ${SHAPE_LIBRARY.length} shapes`
              }
              animate={!flat}
            />
          ) : null}
          {shown.slice(head.length).map((shape) => (
            <ShapeTile
              key={shape.id}
              shape={shape}
              onClick={() => handleAdd(shape)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
