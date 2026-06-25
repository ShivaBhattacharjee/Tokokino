"use client"

import * as React from "react"

import { ScrollFadeRootContext } from "@/components/editor/scroll-fade"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { overlayThumbUrl } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import type { BackdropPickerLayout } from "./constants"

type ObserveFn = (el: Element, cb: () => void) => void
type UnobserveFn = (el: Element) => void

const overlayLoadedCache = new Set<number>()

export const OverlayGrid = React.memo(function OverlayGrid({
  ids,
  selectedId,
  onSelect,
  layout = "grid",
}: {
  ids: number[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  layout?: BackdropPickerLayout
}) {
  const scrollRootRef = React.useContext(ScrollFadeRootContext)
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
      { root: scrollRootRef?.current ?? null, rootMargin: "200px" }
    )
    setObserver(obs)
    const callbacks = callbacksRef.current
    return () => {
      obs.disconnect()
      callbacks.clear()
    }
  }, [scrollRootRef])

  const observe = React.useCallback<ObserveFn>(
    (el, cb) => {
      if (!observer) return
      callbacksRef.current.set(el, cb)
      observer.observe(el)
    },
    [observer]
  )

  const unobserve = React.useCallback<UnobserveFn>(
    (el) => {
      callbacksRef.current.delete(el)
      observer?.unobserve(el)
    },
    [observer]
  )

  const onSelectRef = React.useRef(onSelect)
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const stableSelect = React.useCallback((id: number | null) => {
    onSelectRef.current(id)
  }, [])

  return (
    <div
      className={cn(
        layout === "carousel"
          ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [contain:layout_paint] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-3 gap-3 px-1 py-1 [contain:layout_paint]"
      )}
    >
      <button
        key="none"
        onClick={() => stableSelect(null)}
        title="None"
        className={cn(
          "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-secondary/40 text-[10px] font-medium transition-colors",
          layout === "carousel" && "h-20 w-20 shrink-0",
          selectedId === null
            ? "border-foreground text-foreground ring-1 ring-foreground/30"
            : "border-dashed border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        )}
      >
        None
      </button>
      {ids.map((id) => (
        <OverlayThumb
          key={id}
          id={id}
          observe={observe}
          unobserve={unobserve}
          selected={selectedId === id}
          onSelect={stableSelect}
          layout={layout}
        />
      ))}
    </div>
  )
})

const OverlayThumb = React.memo(function OverlayThumb({
  id,
  observe,
  unobserve,
  selected,
  onSelect,
  layout = "grid",
}: {
  id: number
  observe: ObserveFn
  unobserve: UnobserveFn
  selected: boolean
  onSelect: (id: number) => void
  layout?: BackdropPickerLayout
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const wasCached = overlayLoadedCache.has(id)
  const [visible, setVisible] = React.useState(wasCached)
  const [loaded, setLoaded] = React.useState(wasCached)

  React.useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    observe(el, () => setVisible(true))
    return () => unobserve(el)
  }, [observe, unobserve, visible])

  const handleClick = React.useCallback(() => onSelect(id), [onSelect, id])
  const handleLoad = React.useCallback(() => {
    overlayLoadedCache.add(id)
    setLoaded(true)
  }, [id])

  return (
    <button
      ref={ref}
      onClick={handleClick}
      title={`Overlay ${id}`}
      className={cn(
        "relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-white transition-colors [contain:layout_style_paint]",
        layout === "carousel" && "h-20 w-20 shrink-0",
        selected
          ? "border-primary/40 ring-1 ring-primary/20"
          : "border-border/60 hover:border-foreground/30"
      )}
    >
      {visible ? (
        <ShimmerImage
          src={overlayThumbUrl(id)}
          alt=""
          decoding="async"
          onLoad={handleLoad}
          className={cn("h-full w-full object-cover", !loaded && "opacity-0")}
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
