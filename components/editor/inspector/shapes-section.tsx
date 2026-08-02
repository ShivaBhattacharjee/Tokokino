"use client"

import * as React from "react"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { SHAPE_LIBRARY } from "@/lib/editor/presets"
import type { ShapeEntry } from "@/lib/editor/state-types"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const shapeLoadedCache = new Set<string>()

export function ShapesSection() {
  const {
    addAsset,
    setSelectedAssetId,
    setSelectedTextId,
    setSelectedScreenshotSlotId,
    setIsScreenshotSelected,
    setActiveTool,
  } = useEditor()

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const callbacksRef = React.useRef<Map<Element, () => void>>(new Map())
  const [observer, setObserver] = React.useState<IntersectionObserver | null>(
    null
  )

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const cb = callbacksRef.current.get(entry.target)
          if (cb) {
            cb()
            callbacksRef.current.delete(entry.target)
            obs.unobserve(entry.target)
          }
        }
      },
      { root: scrollRef.current, rootMargin: "200px" }
    )
    setObserver(obs)
    const callbacks = callbacksRef.current
    return () => {
      obs.disconnect()
      callbacks.clear()
    }
  }, [])

  const observe = React.useCallback(
    (el: Element, cb: () => void) => {
      if (!observer) return
      callbacksRef.current.set(el, cb)
      observer.observe(el)
    },
    [observer]
  )

  const unobserve = React.useCallback(
    (el: Element) => {
      callbacksRef.current.delete(el)
      observer?.unobserve(el)
    },
    [observer]
  )

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
        ref={scrollRef}
        className="max-h-[268px] overflow-y-auto overscroll-contain [contain:layout_paint]"
      >
        <div className="grid grid-cols-3 gap-2 px-1 py-1">
          {SHAPE_LIBRARY.map((shape) => (
            <ShapeThumb
              key={shape.id}
              shape={shape}
              observe={observe}
              unobserve={unobserve}
              onAdd={handleAdd}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const ShapeThumb = React.memo(function ShapeThumb({
  shape,
  observe,
  unobserve,
  onAdd,
}: {
  shape: ShapeEntry
  observe: (el: Element, cb: () => void) => void
  unobserve: (el: Element) => void
  onAdd: (shape: ShapeEntry) => void
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const wasCached = shapeLoadedCache.has(shape.id)
  const [visible, setVisible] = React.useState(wasCached)
  const [loaded, setLoaded] = React.useState(wasCached)

  React.useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    observe(el, () => setVisible(true))
    return () => unobserve(el)
  }, [observe, unobserve, visible])

  const handleClick = React.useCallback(() => onAdd(shape), [onAdd, shape])
  const handleLoad = React.useCallback(() => {
    shapeLoadedCache.add(shape.id)
    setLoaded(true)
  }, [shape.id])

  return (
    <button
      ref={ref}
      onClick={handleClick}
      title={`Add ${shape.name}`}
      className="relative aspect-square cursor-pointer overflow-hidden rounded-md border border-border/60 bg-secondary/30 transition-colors [contain:layout_style_paint] hover:border-foreground/30"
    >
      {visible ? (
        <ShimmerImage
          src={shape.thumb}
          alt={shape.name}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          className={cn(
            "h-full w-full object-contain p-1",
            !loaded && "opacity-0"
          )}
        />
      ) : null}
      {(!visible || !loaded) && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
        </span>
      )}
    </button>
  )
})
