"use client"

import * as React from "react"
import {
  RiArrowGoBackLine,
  RiArrowLeftLine,
  RiEqualizerLine,
  RiFocus2Line,
  RiGradienterLine,
  RiGridLine,
  RiMagicLine,
  RiSunLine,
} from "@remixicon/react"
import { motion } from "motion/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  ScrollFadeBody,
  ScrollFadeRootContext,
} from "@/components/editor/scroll-fade"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  BACKDROP_PATTERNS,
  OVERLAY_COUNT,
  assetFilterCss,
  dynamicPatternColors,
  effectsFilterCss,
  overlayThumbUrl,
  patternCssFor,
  sampleImageColors,
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  type AssetFilter,
  type BackdropLighting,
  type PortraitMode,
} from "@/lib/editor/store"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import { cn } from "@/lib/utils"

import { EffectSlider } from "./effect-slider"
import { PopoverHeader } from "./primitives"

const PORTRAIT_MODES: { id: PortraitMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "soft", label: "Soft" },
  { id: "studio", label: "Studio" },
  { id: "spot", label: "Spot" },
  { id: "frame", label: "Frame" },
  { id: "iris", label: "Iris" },
  { id: "blur", label: "Blur" },
  { id: "stage", label: "Stage" },
]

const LIGHTING_COLOR_PRESETS = [
  "#FFFFFF",
  "#DDF5FF",
  "#D8FFE4",
  "#FFE8BD",
  "#FFC7D6",
]

const LIGHTING_DIRECTIONS = [
  { id: "0-0", label: "Top left" },
  { id: "0-2", label: "Top" },
  { id: "0-4", label: "Top right" },
  { id: "2-0", label: "Left" },
  { id: "center", label: "Center" },
  { id: "2-4", label: "Right" },
  { id: "4-0", label: "Bottom left" },
  { id: "4-2", label: "Bottom" },
  { id: "4-4", label: "Bottom right" },
]

const BACKDROP_FX_PREVIEW_VAR = "--bd-fx-preview"
const BACKDROP_NOISE_PREVIEW_VAR = "--bd-noise-opacity"
const activeColorSwatchClass =
  "border-primary shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--primary)/0.9)]"
type BackdropControlId =
  | "overlay"
  | "lighting"
  | "effects"
  | "pattern"
  | "portrait"
  | "filters"
type BackdropPickerLayout = "grid" | "carousel"

function portraitPreviewCss(mode: PortraitMode): React.CSSProperties {
  switch (mode) {
    case "off":
      return {
        background: "linear-gradient(135deg, oklch(0.32 0 0), oklch(0.18 0 0))",
      }
    case "soft":
      return {
        background:
          "radial-gradient(ellipse at 50% 50%, oklch(0.6 0 0) 0%, oklch(0.6 0 0) 30%, oklch(0.1 0 0) 100%)",
      }
    case "studio":
      return {
        background:
          "radial-gradient(ellipse 65% 55% at 50% 45%, oklch(0.78 0 0) 0%, oklch(0.6 0 0) 35%, oklch(0.05 0 0) 95%)",
      }
    case "spot":
      return {
        background:
          "radial-gradient(circle at 50% 45%, #fff 0%, oklch(0.7 0 0) 18%, oklch(0.05 0 0) 70%)",
      }
    case "frame":
      return {
        background: "linear-gradient(135deg, oklch(0.55 0 0), oklch(0.42 0 0))",
        boxShadow: "inset 0 0 18px 6px rgba(0,0,0,0.85)",
      }
    case "iris":
      return {
        background:
          "radial-gradient(circle at 50% 50%, oklch(0.7 0 0) 30%, #000 55%, #000 100%)",
      }
    case "blur":
      return {
        background: "linear-gradient(135deg, oklch(0.7 0 0), oklch(0.5 0 0))",
        filter: "blur(2px)",
      }
    case "stage":
      return {
        background:
          "radial-gradient(circle at 50% 45%, oklch(0.8 0 0) 0%, oklch(0.55 0 0) 12%, #000 38%, #000 100%)",
      }
    default:
      return {}
  }
}

function lightingDirectionPreview(
  direction: string,
  color: string
): React.CSSProperties {
  const [rowRaw, colRaw] =
    direction === "center" ? [2, 2] : direction.split("-")
  const row = Number(rowRaw)
  const col = Number(colRaw)
  const x = Number.isFinite(col) ? Math.max(0, Math.min(4, col)) * 25 : 50
  const y = Number.isFinite(row) ? Math.max(0, Math.min(4, row)) * 25 : 50
  return {
    background: `radial-gradient(circle at ${x}% ${y}%, ${color} 0%, ${color}99 22%, transparent 62%), #111`,
  }
}

function lightingPatch(
  lighting: BackdropLighting,
  patch: Partial<BackdropLighting>
) {
  const next = { ...lighting, ...patch }
  if (
    next.intensity === 0 &&
    (patch.direction !== undefined ||
      patch.target !== undefined ||
      patch.color !== undefined)
  ) {
    next.intensity = 50
  }
  return next
}

function BackdropTile({
  icon: Icon,
  label,
  active,
  onClick,
  ...rest
}: React.ComponentProps<"button"> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "" : undefined}
      className={cn(
        "group relative flex h-[64px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border transition-all",
        active
          ? "border-primary/40 bg-primary/5 text-primary ring-1 ring-primary/20"
          : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        "data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 data-[state=open]:text-primary data-[state=open]:ring-1 data-[state=open]:ring-primary/20"
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </button>
  )
}

function BackdropControlPopover({
  icon,
  label,
  active,
  title,
  description,
  onReset,
  resetTitle,
  children,
  footer,
  className,
  contentClassName,
  bodyClassName,
  footerClassName,
  open,
  onOpenChange,
  forceMount,
  popoverSide = "left",
  presentation = "popover",
  hideTriggerWhenOpen = false,
  inlineBodyMode = "carousel",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  title: string
  description: string
  onReset?: () => void
  resetTitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
  bodyClassName?: string
  footerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  forceMount?: true
  popoverSide?: "left" | "top"
  presentation?: "popover" | "inline"
  hideTriggerWhenOpen?: boolean
  inlineBodyMode?: "carousel" | "content"
}) {
  const [localOpen, setLocalOpen] = React.useState(false)
  const resolvedOpen = open ?? localOpen
  const setResolvedOpen = onOpenChange ?? setLocalOpen
  const closeInlinePanel = React.useCallback(() => {
    setResolvedOpen(false)
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => {
      document
        .querySelector("[data-mobile-backdrop-scroll]")
        ?.scrollTo({ top: 0 })
    })
  }, [setResolvedOpen])

  if (presentation === "inline") {
    return (
      <>
        {hideTriggerWhenOpen && resolvedOpen ? null : (
          <BackdropTile
            icon={icon}
            label={label}
            active={active}
            aria-expanded={resolvedOpen}
            data-state={resolvedOpen ? "open" : "closed"}
            onClick={() => setResolvedOpen(!resolvedOpen)}
          />
        )}
        {resolvedOpen ? (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-3 min-h-0"
          >
            <div
              className={cn(
                "mt-1 flex min-h-0 flex-col rounded-lg bg-sidebar/70 py-2",
                presentation !== "inline" && "px-2",
                contentClassName,
                className,
                "!w-full"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closeInlinePanel}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <RiArrowLeftLine className="size-4" />
                  Back
                </button>
                <span className="min-w-0 flex-1 text-center text-[13px] font-medium text-foreground">
                  {title}
                </span>
                {onReset ? (
                  <button
                    type="button"
                    onClick={onReset}
                    title={resetTitle ?? "Reset"}
                    aria-label={resetTitle ?? "Reset"}
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  >
                    <RiArrowGoBackLine className="size-4" />
                  </button>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden />
                )}
              </div>
              {presentation === "inline" && inlineBodyMode === "content" ? (
                <div className={cn("min-h-0", bodyClassName)}>{children}</div>
              ) : (
                <ScrollFadeBody
                  rootClassName={
                    presentation === "inline" && inlineBodyMode === "carousel"
                      ? "shrink-0"
                      : undefined
                  }
                  className={cn(
                    presentation === "inline" && inlineBodyMode === "carousel"
                      ? "max-h-[156px]"
                      : "max-h-[min(170px,calc(100vh-18rem))]",
                    bodyClassName
                  )}
                  fadeClassName="from-sidebar"
                >
                  {children}
                </ScrollFadeBody>
              )}
              {footer ? (
                <div
                  className={cn(
                    "shrink-0 bg-sidebar/80 py-2",
                    presentation === "inline"
                      ? "mt-0 -mb-2"
                      : "-mx-2 mt-2 -mb-2 border-t border-border/40 px-2",
                    footerClassName
                  )}
                >
                  {footer}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <BackdropTile icon={icon} label={label} active={active} />
      </PopoverTrigger>
      <PopoverContent
        side={popoverSide}
        align={popoverSide === "top" ? "center" : "start"}
        collisionPadding={8}
        forceMount={forceMount}
        className={cn(
          "w-[260px] gap-2 overflow-hidden bg-popover/95 p-2 backdrop-blur-md",
          contentClassName,
          className
        )}
      >
        <PopoverHeader
          title={title}
          description={description}
          onReset={onReset}
          resetTitle={resetTitle}
        />
        <ScrollFadeBody
          className={cn("max-h-[min(220px,calc(100vh-10rem))]", bodyClassName)}
        >
          {children}
        </ScrollFadeBody>
        {footer ? (
          <div
            className={cn(
              "-mx-2 -mb-2 shrink-0 border-t border-border/40 bg-popover px-2 py-2",
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

type ObserveFn = (el: Element, cb: () => void) => void
type UnobserveFn = (el: Element) => void

const overlayLoadedCache = new Set<number>()

const OverlayGrid = React.memo(function OverlayGrid({
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

const BACKDROP_FILTERS: { id: AssetFilter; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "bw", label: "B&W" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "fade", label: "Fade" },
  { id: "vivid", label: "Vivid" },
  { id: "noir", label: "Noir" },
  { id: "dream", label: "Dream" },
  { id: "mono", label: "Mono" },
  { id: "invert", label: "Invert" },
]

function BackdropFilterGrid({
  current,
  onChange,
  layout = "grid",
  columns = 3,
}: {
  current: AssetFilter
  onChange: (f: AssetFilter) => void
  layout?: BackdropPickerLayout
  columns?: 3 | 4
}) {
  return (
    <div
      className={cn(
        layout === "carousel"
          ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : columns === 4
            ? "grid grid-cols-4 gap-2 px-1 py-1"
            : "grid grid-cols-3 gap-2 px-1 py-1"
      )}
    >
      {BACKDROP_FILTERS.map((f) => {
        const active = current === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1 transition-all",
              layout === "carousel" && "w-20 shrink-0",
              active
                ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div
              className="aspect-square w-full rounded-sm"
              style={{
                background: "linear-gradient(135deg,#6366f1,#ec4899,#f59e0b)",
                filter: assetFilterCss(f.id),
              }}
            />
            <span
              className={cn(
                "text-[9px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {f.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function BackdropSection({
  popoverSide = "left",
  controlsVariant = "popover",
}: {
  popoverSide?: "left" | "top"
  controlsVariant?: "popover" | "inline"
} = {}) {
  const backdrop = useActiveCanvasField((c) => c.backdrop)
  const background = useActiveCanvasField((c) => c.background)
  const overlay = useActiveCanvasField((c) => c.overlay)
  const portrait = useActiveCanvasField((c) => c.portrait)
  const canvasBorderRadius = useActiveCanvasField((c) => c.canvasBorderRadius)
  const { applyStyle, selectedSlot } = useScreenshotStyleTarget()
  const activeCanvasId = useActiveCanvasId()
  const setBackdropEffects = useEditorStore((s) => s.setBackdropEffects)
  const setBackdropPattern = useEditorStore((s) => s.setBackdropPattern)
  const setBackdropLighting = useEditorStore((s) => s.setBackdropLighting)
  const setMainScreenshotBackdropLighting = useEditorStore(
    (s) => s.setMainScreenshotBackdropLighting
  )
  const setBackdropFilter = useEditorStore((s) => s.setBackdropFilter)
  const setOverlay = useEditorStore((s) => s.setOverlay)
  const setPortrait = useEditorStore((s) => s.setPortrait)
  const setCanvasBorderRadius = useEditorStore((s) => s.setCanvasBorderRadius)
  const {
    effects,
    pattern,
    lighting,
    filter: backdropFilter = "none",
  } = backdrop
  const activeLighting = selectedSlot?.lighting ?? lighting

  // Live-preview CSS vars on the active canvas: dragging sliders writes to
  // these vars directly so the canvas updates without re-rendering the store
  // until the user releases the slider. See tilt-section.tsx for the same
  // pattern applied to tilt/scale.
  const getCanvasEl = React.useCallback((): HTMLElement | null => {
    if (typeof document === "undefined" || !activeCanvasId) return null
    return document.querySelector(`[data-canvas-id="${activeCanvasId}"]`)
  }, [activeCanvasId])
  const setPreviewVar = React.useCallback(
    (name: string, value: string | null) => {
      const el = getCanvasEl()
      if (!el) return
      if (value === null) el.style.removeProperty(name)
      else el.style.setProperty(name, value)
    },
    [getCanvasEl]
  )
  const clearPreviewVarAfterPaint = React.useCallback(
    (name: string) => {
      if (typeof requestAnimationFrame === "undefined") return
      requestAnimationFrame(() => setPreviewVar(name, null))
    },
    [setPreviewVar]
  )
  const [imageColors, setImageColors] = React.useState<string[] | null>(null)

  const isImageBackground = background.type === "image"

  React.useEffect(() => {
    if (!isImageBackground) return
    const colorSampleUrl = background.thumbUrl ?? background.value
    let cancelled = false
    sampleImageColors(colorSampleUrl)
      .then((cs) => {
        if (!cancelled) setImageColors(cs.length ? cs : null)
      })
      .catch(() => {
        if (!cancelled) setImageColors(null)
      })
    return () => {
      cancelled = true
    }
  }, [isImageBackground, background.thumbUrl, background.value])

  const patternColors = React.useMemo(() => {
    if (isImageBackground && imageColors?.length) return imageColors
    return dynamicPatternColors(background)
  }, [background, isImageBackground, imageColors])

  const commitEffects = (patch: Partial<typeof effects>) => {
    setBackdropEffects({ ...effects, ...patch })
    clearPreviewVarAfterPaint(BACKDROP_FX_PREVIEW_VAR)
    clearPreviewVarAfterPaint(BACKDROP_NOISE_PREVIEW_VAR)
  }
  const previewEffects = (patch: Partial<typeof effects>) => {
    const candidate = { ...effects, ...patch }
    setPreviewVar(BACKDROP_FX_PREVIEW_VAR, effectsFilterCss(candidate) ?? null)
    if (patch.noise !== undefined) {
      setPreviewVar(
        BACKDROP_NOISE_PREVIEW_VAR,
        `${Math.max(0, Math.min(100, candidate.noise)) / 100}`
      )
    }
  }
  const setPattern = (patch: Partial<typeof pattern>) =>
    setBackdropPattern({ ...pattern, ...patch })
  const applyLighting = (nextLighting: typeof lighting) => {
    applyStyle(
      { lighting: nextLighting },
      () => setMainScreenshotBackdropLighting(nextLighting),
      () => setBackdropLighting(nextLighting)
    )
  }
  const setLighting = (patch: Partial<typeof lighting>) =>
    applyLighting(lightingPatch(activeLighting, patch))
  const overlayRef = React.useRef(overlay)
  React.useEffect(() => {
    overlayRef.current = overlay
  })
  const setOverlayPatch = React.useCallback(
    (patch: Partial<typeof overlay>) =>
      setOverlay({ ...overlayRef.current, ...patch }),
    [setOverlay]
  )

  const overlayIds = React.useMemo(
    () => Array.from({ length: OVERLAY_COUNT }, (_, i) => i + 1),
    []
  )

  const [overlayPopoverOpen, setOverlayPopoverOpen] = React.useState(false)
  const [overlayHasOpened, setOverlayHasOpened] = React.useState(false)
  const [inlineControl, setInlineControl] =
    React.useState<BackdropControlId | null>(null)
  const usesInlineControls = controlsVariant === "inline"
  const handleInlineControlOpenChange = React.useCallback(
    (id: BackdropControlId) => (open: boolean) => {
      setInlineControl(open ? id : null)
    },
    []
  )
  const handleOverlayOpenChange = React.useCallback((open: boolean) => {
    setOverlayPopoverOpen(open)
    if (open) setOverlayHasOpened(true)
  }, [])
  const handleOverlayControlOpenChange = React.useCallback(
    (open: boolean) => {
      if (usesInlineControls) {
        setInlineControl(open ? "overlay" : null)
        if (open) setOverlayHasOpened(true)
        return
      }
      handleOverlayOpenChange(open)
    },
    [handleOverlayOpenChange, usesInlineControls]
  )

  const effectsDirty =
    effects.brightness !== 100 ||
    effects.contrast !== 100 ||
    effects.saturation !== 100 ||
    effects.hue !== 0 ||
    effects.grayscale !== 0 ||
    effects.sepia !== 0 ||
    effects.invert !== 0 ||
    effects.blur !== 0 ||
    effects.noise !== 0 ||
    effects.opacity !== 100
  const overlayActive = overlay.id !== null
  const patternActive = pattern.ids.length > 0
  const portraitActive = portrait.mode !== "off"
  const lightingActive = activeLighting.intensity > 0
  const shouldRenderControl = React.useCallback(
    (id: BackdropControlId) =>
      !usesInlineControls || inlineControl === null || inlineControl === id,
    [inlineControl, usesInlineControls]
  )
  const isInlineDrillIn = usesInlineControls && inlineControl !== null
  const pickerLayout: BackdropPickerLayout = usesInlineControls
    ? "carousel"
    : "grid"

  return (
    <div
      className={cn("flex flex-col gap-4", isInlineDrillIn && "min-h-0 gap-0")}
    >
      {isInlineDrillIn ? null : (
        <div className="pt-1">
          <EffectSlider
            label="Canvas Radius"
            value={canvasBorderRadius}
            onChange={(v) => {
              setCanvasBorderRadius(v)
              clearPreviewVarAfterPaint("--canvas-bd-radius")
            }}
            onPreview={(v) => setPreviewVar("--canvas-bd-radius", `${v}px`)}
            max={80}
          />
        </div>
      )}

      <div
        className={cn("grid grid-cols-3 gap-2", isInlineDrillIn && "min-h-0")}
      >
        {shouldRenderControl("overlay") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            icon={RiSunLine}
            label="Overlay"
            active={overlayActive}
            title="Shadow Overlay"
            description="Drape a soft light or shadow texture over the canvas."
            onReset={() =>
              setOverlay({ id: null, opacity: 50, position: "overlay" })
            }
            resetTitle="Reset overlay"
            open={
              usesInlineControls
                ? inlineControl === "overlay"
                : overlayPopoverOpen
            }
            onOpenChange={handleOverlayControlOpenChange}
            forceMount={overlayHasOpened ? true : undefined}
            contentClassName="w-[240px] [contain:layout_paint] data-[state=closed]:pointer-events-none data-[state=closed]:invisible"
            bodyClassName="pr-1"
            footer={
              <div className="space-y-3">
                <div className="min-w-0">
                  <EffectSlider
                    label="Opacity"
                    value={overlay.opacity}
                    onChange={(v) => {
                      setOverlayPatch({ opacity: v })
                      clearPreviewVarAfterPaint("--bd-overlay-opacity")
                    }}
                    onPreview={(v) =>
                      setPreviewVar("--bd-overlay-opacity", `${v / 100}`)
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <span className="text-[11px] text-muted-foreground">
                    Position
                  </span>
                  <ToggleGroup
                    type="single"
                    value={overlay.position}
                    onValueChange={(v) =>
                      v &&
                      setOverlayPatch({ position: v as "overlay" | "underlay" })
                    }
                    className="flex w-full rounded-md bg-secondary/60 p-1"
                  >
                    <ToggleGroupItem
                      value="overlay"
                      className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                    >
                      Overlay
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="underlay"
                      className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                    >
                      Underlay
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            }
          >
            <OverlayGrid
              ids={overlayIds}
              selectedId={overlay.id}
              onSelect={(id) => setOverlayPatch({ id })}
              layout={pickerLayout}
            />
          </BackdropControlPopover>
        ) : null}

        {shouldRenderControl("lighting") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            icon={RiSunLine}
            label="Lighting"
            active={lightingActive}
            title="Lighting"
            description="Cast directional light on the backdrop or the screenshot."
            onReset={() =>
              applyLighting({
                target: "inner",
                intensity: 0,
                direction: "0-0",
                color: "#FFFFFF",
              })
            }
            resetTitle="Reset lighting"
            open={usesInlineControls ? inlineControl === "lighting" : undefined}
            onOpenChange={
              usesInlineControls
                ? handleInlineControlOpenChange("lighting")
                : undefined
            }
            contentClassName="w-[240px]"
            bodyClassName="pr-1 overflow-y-auto max-h-[140px] md:max-h-[min(220px,calc(100vh-10rem))]"
            footer={
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-[11px] text-muted-foreground">
                    Target
                  </span>
                  <ToggleGroup
                    type="single"
                    value={activeLighting.target}
                    onValueChange={(v) =>
                      v && setLighting({ target: v as "outer" | "inner" })
                    }
                    className="flex w-full rounded-md bg-secondary/60 p-1"
                  >
                    <ToggleGroupItem
                      value="inner"
                      className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                    >
                      Inner
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="outer"
                      className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                    >
                      Outer
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <EffectSlider
                  label="Intensity"
                  value={activeLighting.intensity}
                  onChange={(v) => setLighting({ intensity: v })}
                />

                <div>
                  <span className="mb-2 block text-[11px] text-muted-foreground">
                    Colour
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {LIGHTING_COLOR_PRESETS.map((c) => {
                      const isActive =
                        activeLighting.color.trim().toLowerCase() ===
                        c.trim().toLowerCase()
                      return (
                        <button
                          key={c}
                          onClick={() => setLighting({ color: c })}
                          className={cn(
                            "size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                            isActive && activeColorSwatchClass
                          )}
                          style={{ background: c }}
                        />
                      )
                    })}
                    <ColorPickerPopover
                      value={activeLighting.color}
                      onChange={(hex) => setLighting({ color: hex })}
                    >
                      <button
                        aria-label="Custom lighting color"
                        className={cn(
                          "relative size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                          !LIGHTING_COLOR_PRESETS.some(
                            (c) =>
                              c.trim().toLowerCase() ===
                              activeLighting.color.trim().toLowerCase()
                          ) && activeColorSwatchClass
                        )}
                        style={{
                          background: LIGHTING_COLOR_PRESETS.some(
                            (c) =>
                              c.trim().toLowerCase() ===
                              activeLighting.color.trim().toLowerCase()
                          )
                            ? "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)"
                            : activeLighting.color,
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white">
                          <RiGradienterLine className="size-3.5" />
                        </span>
                      </button>
                    </ColorPickerPopover>
                  </div>
                </div>
              </div>
            }
          >
            <div
              className={cn(
                pickerLayout === "carousel"
                  ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  : "grid grid-cols-3 gap-1.5 px-1 py-1"
              )}
            >
              {LIGHTING_DIRECTIONS.map((direction) => {
                const active =
                  lightingActive && activeLighting.direction === direction.id
                return (
                  <button
                    key={direction.id}
                    onClick={() => setLighting({ direction: direction.id })}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-md border bg-secondary/20 p-1 transition-all",
                      pickerLayout === "carousel" && "w-20 shrink-0",
                      active
                        ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                        : "border-border/60 hover:border-foreground/30"
                    )}
                    title={direction.label}
                  >
                    <div
                      className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-950"
                      style={lightingDirectionPreview(
                        direction.id,
                        activeLighting.color
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-0 m-auto size-1.5 rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
                          active && "bg-primary"
                        )}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </BackdropControlPopover>
        ) : null}

        {shouldRenderControl("effects") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            inlineBodyMode="content"
            icon={RiEqualizerLine}
            label="Effects"
            active={effectsDirty}
            title="Effects"
            description="Color & filter adjustments applied to the backdrop layer."
            onReset={() =>
              setBackdropEffects({
                noise: 0,
                blur: 0,
                brightness: 100,
                contrast: 100,
                saturation: 100,
                hue: 0,
                grayscale: 0,
                sepia: 0,
                invert: 0,
                opacity: 100,
              })
            }
            resetTitle="Reset effects"
            open={usesInlineControls ? inlineControl === "effects" : undefined}
            onOpenChange={
              usesInlineControls
                ? handleInlineControlOpenChange("effects")
                : undefined
            }
            contentClassName="w-[240px]"
            bodyClassName="space-y-2.5 pr-1"
          >
            <EffectSlider
              label="Brightness"
              value={effects.brightness}
              onChange={(v) => commitEffects({ brightness: v })}
              onPreview={(v) => previewEffects({ brightness: v })}
              max={200}
            />
            <EffectSlider
              label="Contrast"
              value={effects.contrast}
              onChange={(v) => commitEffects({ contrast: v })}
              onPreview={(v) => previewEffects({ contrast: v })}
              max={200}
            />
            <EffectSlider
              label="Saturation"
              value={effects.saturation}
              onChange={(v) => commitEffects({ saturation: v })}
              onPreview={(v) => previewEffects({ saturation: v })}
              max={200}
            />
            <EffectSlider
              label="Hue"
              value={effects.hue}
              onChange={(v) => commitEffects({ hue: v })}
              onPreview={(v) => previewEffects({ hue: v })}
              max={360}
              suffix="°"
            />
            <EffectSlider
              label="Grayscale"
              value={effects.grayscale}
              onChange={(v) => commitEffects({ grayscale: v })}
              onPreview={(v) => previewEffects({ grayscale: v })}
            />
            <EffectSlider
              label="Sepia"
              value={effects.sepia}
              onChange={(v) => commitEffects({ sepia: v })}
              onPreview={(v) => previewEffects({ sepia: v })}
            />
            <EffectSlider
              label="Invert"
              value={effects.invert}
              onChange={(v) => commitEffects({ invert: v })}
              onPreview={(v) => previewEffects({ invert: v })}
            />
            <EffectSlider
              label="Blur"
              value={effects.blur}
              onChange={(v) => commitEffects({ blur: v })}
              onPreview={(v) => previewEffects({ blur: v })}
              max={20}
              suffix="px"
            />
            <EffectSlider
              label="Noise"
              value={effects.noise}
              onChange={(v) => commitEffects({ noise: v })}
              onPreview={(v) => previewEffects({ noise: v })}
            />
            <EffectSlider
              label="Opacity"
              value={effects.opacity}
              onChange={(v) => commitEffects({ opacity: v })}
              onPreview={(v) => previewEffects({ opacity: v })}
            />
          </BackdropControlPopover>
        ) : null}

        {shouldRenderControl("pattern") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            icon={RiGridLine}
            label="Pattern"
            active={patternActive}
            title="Patterns"
            description="Layer geometric textures on top of your backdrop."
            onReset={() =>
              setBackdropPattern({
                ids: [],
                intensity: 50,
                thickness: 1,
                color: "#FFFFFF",
              })
            }
            resetTitle="Reset patterns"
            open={usesInlineControls ? inlineControl === "pattern" : undefined}
            onOpenChange={
              usesInlineControls
                ? handleInlineControlOpenChange("pattern")
                : undefined
            }
            contentClassName="w-[240px]"
            bodyClassName="pr-1"
            footer={
              <div className="space-y-3">
                <EffectSlider
                  label="Intensity"
                  value={pattern.intensity}
                  onChange={(v) => {
                    setPattern({ intensity: v })
                    clearPreviewVarAfterPaint("--bd-pattern-intensity")
                  }}
                  onPreview={(v) =>
                    setPreviewVar("--bd-pattern-intensity", `${v / 100}`)
                  }
                />

                <EffectSlider
                  label="Thickness"
                  value={pattern.thickness}
                  onChange={(v) => setPattern({ thickness: v })}
                  min={1}
                  max={10}
                  step={0.5}
                  suffix="px"
                />

                <div>
                  <span className="mb-2 block text-[11px] text-muted-foreground">
                    Colour
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {patternColors.map((c) => {
                      const isActive =
                        pattern.color.trim().toLowerCase() ===
                        c.trim().toLowerCase()
                      return (
                        <button
                          key={c}
                          onClick={() => setPattern({ color: c })}
                          className={cn(
                            "size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                            isActive && activeColorSwatchClass
                          )}
                          style={{ background: c }}
                        />
                      )
                    })}
                    <ColorPickerPopover
                      value={pattern.color}
                      onChange={(hex) => setPattern({ color: hex })}
                    >
                      <button
                        aria-label="Custom pattern color"
                        className={cn(
                          "relative size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                          !patternColors.some(
                            (c) =>
                              c.trim().toLowerCase() ===
                              pattern.color.trim().toLowerCase()
                          ) && activeColorSwatchClass
                        )}
                        style={{
                          background: patternColors.some(
                            (c) =>
                              c.trim().toLowerCase() ===
                              pattern.color.trim().toLowerCase()
                          )
                            ? "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)"
                            : pattern.color,
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white">
                          <RiGradienterLine className="size-3.5" />
                        </span>
                      </button>
                    </ColorPickerPopover>
                  </div>
                </div>
              </div>
            }
          >
            <div
              className={cn(
                pickerLayout === "carousel"
                  ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  : "grid grid-cols-3 gap-2 pr-1"
              )}
            >
              <button
                key="none"
                onClick={() => setPattern({ ids: [] })}
                title="None"
                className={cn(
                  "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-secondary/40 text-[10px] font-medium text-muted-foreground transition-all",
                  pickerLayout === "carousel" && "h-20 w-20 shrink-0",
                  pattern.ids.length === 0
                    ? "border-foreground text-foreground ring-1 ring-foreground/30"
                    : "border-dashed border-border/60 hover:border-foreground/30 hover:text-foreground"
                )}
              >
                None
              </button>
              {BACKDROP_PATTERNS.map((p) => {
                const selected = pattern.ids.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setPattern({
                        ids: selected
                          ? pattern.ids.filter((v) => v !== p.id)
                          : [...pattern.ids, p.id],
                      })
                    }
                    style={patternCssFor(
                      p.id,
                      pattern.color,
                      pattern.thickness
                    )}
                    className={cn(
                      "relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-neutral-900 transition-all",
                      pickerLayout === "carousel" && "h-20 w-20 shrink-0",
                      selected
                        ? "border-foreground ring-1 ring-foreground/30"
                        : "border-border/60 hover:border-foreground/30"
                    )}
                    title={p.name}
                  />
                )
              })}
            </div>
          </BackdropControlPopover>
        ) : null}

        {shouldRenderControl("portrait") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            icon={RiFocus2Line}
            label="Portrait"
            active={portraitActive}
            title="Portrait Mode"
            description="Cinematic depth - blends a vignette around your screenshot."
            onReset={() =>
              setPortrait({
                mode: "off",
                intensity: 60,
                position: 50,
                distance: 50,
              })
            }
            resetTitle="Reset portrait"
            open={usesInlineControls ? inlineControl === "portrait" : undefined}
            onOpenChange={
              usesInlineControls
                ? handleInlineControlOpenChange("portrait")
                : undefined
            }
            footer={
              portrait.mode !== "off" ? (
                <div className="space-y-3">
                  <EffectSlider
                    label="Intensity"
                    value={portrait.intensity}
                    onChange={(v) => setPortrait({ ...portrait, intensity: v })}
                  />
                  <EffectSlider
                    label="Position"
                    value={portrait.position}
                    onChange={(v) => setPortrait({ ...portrait, position: v })}
                    suffix=""
                  />
                  <EffectSlider
                    label="Distance"
                    value={portrait.distance}
                    onChange={(v) => setPortrait({ ...portrait, distance: v })}
                    suffix=""
                  />
                </div>
              ) : null
            }
          >
            <div
              className={cn(
                pickerLayout === "carousel"
                  ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  : "grid grid-cols-3 gap-1.5"
              )}
            >
              {PORTRAIT_MODES.map((m) => {
                const active = portrait.mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setPortrait({ ...portrait, mode: m.id })}
                    className={cn(
                      "group relative flex aspect-square cursor-pointer flex-col items-center justify-end overflow-hidden rounded-lg border bg-neutral-900 p-1.5 transition-all",
                      pickerLayout === "carousel" && "h-20 w-20 shrink-0",
                      active
                        ? "border-foreground ring-1 ring-foreground/30"
                        : "border-border/60 hover:border-foreground/30"
                    )}
                    title={m.label}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={portraitPreviewCss(m.id)}
                    />
                    <span
                      className={cn(
                        "relative z-10 rounded-sm bg-black/60 px-1 text-[9px] font-medium text-white/95 backdrop-blur-sm",
                        active && "bg-foreground text-background"
                      )}
                    >
                      {m.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </BackdropControlPopover>
        ) : null}

        {shouldRenderControl("filters") ? (
          <BackdropControlPopover
            popoverSide={popoverSide}
            presentation={controlsVariant}
            hideTriggerWhenOpen={usesInlineControls}
            inlineBodyMode="content"
            icon={RiMagicLine}
            label="Filters"
            active={backdropFilter !== "none"}
            title="Filters"
            description="Apply a colour grade to the background."
            onReset={() => setBackdropFilter("none")}
            resetTitle="Reset filter"
            open={usesInlineControls ? inlineControl === "filters" : undefined}
            onOpenChange={
              usesInlineControls
                ? handleInlineControlOpenChange("filters")
                : undefined
            }
          >
            <BackdropFilterGrid
              current={backdropFilter}
              onChange={setBackdropFilter}
              layout="grid"
              columns={usesInlineControls ? 4 : 3}
            />
          </BackdropControlPopover>
        ) : null}
      </div>
    </div>
  )
}
