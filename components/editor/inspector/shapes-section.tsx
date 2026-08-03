"use client"

import * as React from "react"

import { SHAPE_LIBRARY } from "@/lib/editor/presets"
import type { ShapeEntry } from "@/lib/editor/state-types"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

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
  const scrollRootRef = React.useRef<HTMLElement | null>(null)
  const [count, setCount] = React.useState(SHAPE_BATCH)

  const loadMore = React.useCallback(() => {
    setCount((c) => Math.min(c + SHAPE_BATCH, SHAPE_LIBRARY.length))
  }, [])

  // Flat mode scrolls in an ancestor panel rather than in our own box, so the
  // listener has to go on whichever element actually scrolls.
  React.useEffect(() => {
    const root = flat ? findScrollParent(wrapRef.current) : wrapRef.current
    scrollRootRef.current = root
    if (!root) {
      setCount(SHAPE_LIBRARY.length)
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
  }, [flat, loadMore])

  // A batch that doesn't overflow the scroller leaves nothing to scroll, so
  // the rest would be unreachable — keep topping up until it does.
  React.useEffect(() => {
    const root = scrollRootRef.current
    if (!root || count >= SHAPE_LIBRARY.length) return
    if (root.scrollHeight <= root.clientHeight) loadMore()
  }, [count, loadMore])

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

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] text-muted-foreground">
        Click a shape to drop it on the canvas.
      </p>
      <div
        ref={wrapRef}
        className={cn(
          "[contain:layout_paint]",
          !flat && "max-h-[268px] overflow-y-auto overscroll-contain"
        )}
      >
        <div
          className={cn(
            "grid gap-2 px-1 py-1",
            flat ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          {SHAPE_LIBRARY.slice(0, count).map((shape) => (
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
