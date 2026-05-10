"use client"

import * as React from "react"
import {
  RiEqualizerLine,
  RiFocus2Line,
  RiGradienterLine,
  RiGridLine,
  RiMagicLine,
  RiSunLine,
} from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { EditableValue } from "@/components/editor/editable-value"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  BACKDROP_PATTERNS,
  OVERLAY_COUNT,
  assetFilterCss,
  dynamicPatternColors,
  overlayThumbUrl,
  patternCssFor,
  sampleImageColors,
  useEditor,
  type AssetFilter,
  type PortraitMode,
} from "@/lib/editor/store"
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

function portraitPreviewCss(mode: PortraitMode): React.CSSProperties {
  switch (mode) {
    case "off":
      return {
        background:
          "linear-gradient(135deg, oklch(0.32 0 0), oklch(0.18 0 0))",
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
        background:
          "linear-gradient(135deg, oklch(0.55 0 0), oklch(0.42 0 0))",
        boxShadow: "inset 0 0 18px 6px rgba(0,0,0,0.85)",
      }
    case "iris":
      return {
        background:
          "radial-gradient(circle at 50% 50%, oklch(0.7 0 0) 30%, #000 55%, #000 100%)",
      }
    case "blur":
      return {
        background:
          "linear-gradient(135deg, oklch(0.7 0 0), oklch(0.5 0 0))",
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
        "group relative flex h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg border transition-all cursor-pointer",
        active
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 text-primary"
          : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        "data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 data-[state=open]:ring-1 data-[state=open]:ring-primary/20 data-[state=open]:text-primary"
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </button>
  )
}

type ObserveFn = (el: Element, cb: () => void) => void
type UnobserveFn = (el: Element) => void

const overlayLoadedCache = new Set<number>()

function OverlayGrid({
  ids,
  selectedId,
  onSelect,
}: {
  ids: number[]
  selectedId: number | null
  onSelect: (id: number | null) => void
}) {
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
      ref={scrollRef}
      className="grid max-h-[240px] grid-cols-3 gap-3 overflow-y-auto px-1 py-1 [contain:layout_paint] [scrollbar-width:thin]"
    >
      <button
        key="none"
        onClick={() => stableSelect(null)}
        title="None"
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-secondary/40 text-[10px] font-medium transition-colors cursor-pointer",
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
        />
      ))}
    </div>
  )
}

const OverlayThumb = React.memo(function OverlayThumb({
  id,
  observe,
  unobserve,
  selected,
  onSelect,
}: {
  id: number
  observe: ObserveFn
  unobserve: UnobserveFn
  selected: boolean
  onSelect: (id: number) => void
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
        "relative aspect-square overflow-hidden rounded-md border bg-white cursor-pointer transition-colors [contain:layout_style_paint]",
        selected
          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-popover"
          : "border-border/60 hover:border-foreground/30"
      )}
    >
      {visible ? (
        <img
          src={overlayThumbUrl(id)}
          alt=""
          decoding="async"
          onLoad={handleLoad}
          className={cn(
            "h-full w-full object-cover",
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
}: {
  current: AssetFilter
  onChange: (f: AssetFilter) => void
}) {
  return (
    <div className="grid max-h-[240px] grid-cols-3 gap-1.5 overflow-y-auto px-1 py-1 [scrollbar-width:thin]">
      {BACKDROP_FILTERS.map((f) => {
        const active = current === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-1 transition-all cursor-pointer",
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

export function BackdropSection() {
  const {
    backdrop,
    background,
    overlay,
    portrait,
    canvasBorderRadius,
    setBackdropEffects,
    setBackdropPattern,
    setBackdropFilter,
    setOverlay,
    setPortrait,
    setCanvasBorderRadius,
  } = useEditor()
  const { effects, pattern, filter: backdropFilter = "none" } = backdrop
  const [imageColors, setImageColors] = React.useState<string[] | null>(null)
  const [localRadius, setLocalRadius] = React.useState(canvasBorderRadius)
  React.useEffect(() => { setLocalRadius(canvasBorderRadius) }, [canvasBorderRadius])

  const isImageBackground = background.type === "image"

  React.useEffect(() => {
    if (!isImageBackground) return
    let cancelled = false
    sampleImageColors(background.value)
      .then((cs) => {
        if (!cancelled) setImageColors(cs.length ? cs : null)
      })
      .catch(() => {
        if (!cancelled) setImageColors(null)
      })
    return () => {
      cancelled = true
    }
  }, [isImageBackground, background.value])

  const patternColors = React.useMemo(() => {
    if (isImageBackground && imageColors?.length) return imageColors
    return dynamicPatternColors(background)
  }, [background, isImageBackground, imageColors])

  const setEffects = (patch: Partial<typeof effects>) =>
    setBackdropEffects({ ...effects, ...patch })
  const setPattern = (patch: Partial<typeof pattern>) =>
    setBackdropPattern({ ...pattern, ...patch })
  const setOverlayPatch = (patch: Partial<typeof overlay>) =>
    setOverlay({ ...overlay, ...patch })

  const overlayIds = React.useMemo(
    () => Array.from({ length: OVERLAY_COUNT }, (_, i) => i + 1),
    []
  )

  const [overlayPopoverOpen, setOverlayPopoverOpen] = React.useState(false)
  const [overlayHasOpened, setOverlayHasOpened] = React.useState(false)
  const handleOverlayOpenChange = React.useCallback((open: boolean) => {
    setOverlayPopoverOpen(open)
    if (open) setOverlayHasOpened(true)
  }, [])

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

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <EffectSlider
          label="Canvas Radius"
          value={localRadius}
          onChange={(v) => {
            setLocalRadius(v)
            setCanvasBorderRadius(v)
          }}
          onValueCommit={setCanvasBorderRadius}
          max={80}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Popover open={overlayPopoverOpen} onOpenChange={handleOverlayOpenChange}>
          <PopoverTrigger asChild>
            <BackdropTile icon={RiSunLine} label="Overlay" active={overlayActive} />
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            forceMount={overlayHasOpened ? true : undefined}
            className="w-[240px] space-y-2 bg-popover/95 backdrop-blur-md [contain:layout_paint] data-[state=closed]:pointer-events-none data-[state=closed]:invisible"
          >
            <PopoverHeader
              title="Shadow Overlay"
              description="Drape a soft light or shadow texture over the canvas."
              onReset={() => setOverlay({ id: null, opacity: 50, position: "overlay" })}
              resetTitle="Reset overlay"
            />
            <OverlayGrid
              ids={overlayIds}
              selectedId={overlay.id}
              onSelect={(id) => setOverlayPatch({ id })}
            />
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Opacity</span>
                  <EditableValue
                    value={overlay.opacity}
                    onChange={(v) => setOverlayPatch({ opacity: v })}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </div>
                <Slider
                  value={[overlay.opacity]}
                  onValueChange={([v]) => setOverlayPatch({ opacity: v })}
                  max={100}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] text-muted-foreground">Position</span>
                <ToggleGroup
                  type="single"
                  value={overlay.position}
                  onValueChange={(v) =>
                    v && setOverlayPatch({ position: v as "overlay" | "underlay" })
                  }
                  className="flex w-full rounded-md bg-secondary/60 p-1"
                >
                  <ToggleGroupItem
                    value="overlay"
                    className="flex-1 h-7 text-[10px] cursor-pointer rounded-[4px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-transparent hover:text-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                  >
                    Overlay
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="underlay"
                    className="flex-1 h-7 text-[10px] cursor-pointer rounded-[4px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:bg-transparent hover:text-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                  >
                    Underlay
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <BackdropTile icon={RiEqualizerLine} label="Effects" active={effectsDirty} />
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-[240px] space-y-2 bg-popover/95 backdrop-blur-md">
            <PopoverHeader
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
            />
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
              <EffectSlider
                label="Brightness"
                value={effects.brightness}
                onChange={(v) => setEffects({ brightness: v })}
                max={200}
              />
              <EffectSlider
                label="Contrast"
                value={effects.contrast}
                onChange={(v) => setEffects({ contrast: v })}
                max={200}
              />
              <EffectSlider
                label="Saturation"
                value={effects.saturation}
                onChange={(v) => setEffects({ saturation: v })}
                max={200}
              />
              <EffectSlider
                label="Hue"
                value={effects.hue}
                onChange={(v) => setEffects({ hue: v })}
                max={360}
                suffix="°"
              />
              <EffectSlider
                label="Grayscale"
                value={effects.grayscale}
                onChange={(v) => setEffects({ grayscale: v })}
              />
              <EffectSlider
                label="Sepia"
                value={effects.sepia}
                onChange={(v) => setEffects({ sepia: v })}
              />
              <EffectSlider
                label="Invert"
                value={effects.invert}
                onChange={(v) => setEffects({ invert: v })}
              />
              <EffectSlider
                label="Blur"
                value={effects.blur}
                onChange={(v) => setEffects({ blur: v })}
                max={20}
                suffix="px"
              />
              <EffectSlider
                label="Noise"
                value={effects.noise}
                onChange={(v) => setEffects({ noise: v })}
              />
              <EffectSlider
                label="Opacity"
                value={effects.opacity}
                onChange={(v) => setEffects({ opacity: v })}
              />
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <BackdropTile icon={RiGridLine} label="Pattern" active={patternActive} />
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            className="w-[240px] space-y-2 bg-popover/95 backdrop-blur-md"
          >
            <PopoverHeader
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
            />
            <div className="grid max-h-[228px] grid-cols-3 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              <button
                key="none"
                onClick={() => setPattern({ ids: [] })}
                title="None"
                className={cn(
                  "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-secondary/40 text-[10px] font-medium text-muted-foreground transition-all cursor-pointer",
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
                    style={patternCssFor(p.id, pattern.color, pattern.thickness)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-md border bg-neutral-900 transition-all cursor-pointer",
                      selected
                        ? "border-foreground ring-1 ring-foreground/30"
                        : "border-border/60 hover:border-foreground/30"
                    )}
                    title={p.name}
                  />
                )
              })}
            </div>

            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Intensity</span>
                  <EditableValue
                    value={pattern.intensity}
                    onChange={(v) => setPattern({ intensity: v })}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </div>
                <Slider
                  value={[pattern.intensity]}
                  onValueChange={([v]) => setPattern({ intensity: v })}
                  max={100}
                  className="cursor-pointer"
                />
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Thickness</span>
                  <EditableValue
                    value={pattern.thickness}
                    onChange={(v) => setPattern({ thickness: v })}
                    min={1}
                    max={10}
                    step={0.5}
                    suffix="px"
                  />
                </div>
                <Slider
                  value={[pattern.thickness]}
                  onValueChange={([v]) => setPattern({ thickness: v })}
                  min={1}
                  max={10}
                  step={0.5}
                  className="cursor-pointer"
                />
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block mb-2">Colour</span>
                <div className="flex flex-wrap items-center gap-2">
                  {patternColors.map((c) => {
                    const isActive =
                      pattern.color.trim().toLowerCase() === c.trim().toLowerCase()
                    return (
                      <button
                        key={c}
                        onClick={() => setPattern({ color: c })}
                        className={cn(
                          "size-8 rounded-full border border-border/60 cursor-pointer transition-transform hover:scale-110",
                          isActive &&
                          "ring-2 ring-primary ring-offset-1 ring-offset-popover"
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
                        "relative size-8 rounded-full border border-border/60 cursor-pointer transition-transform hover:scale-110",
                        !patternColors.some(
                          (c) =>
                            c.trim().toLowerCase() ===
                            pattern.color.trim().toLowerCase()
                        ) && "ring-2 ring-primary ring-offset-1 ring-offset-popover"
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
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <BackdropTile icon={RiFocus2Line} label="Portrait" active={portraitActive} />
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            className="w-[260px] space-y-2 bg-popover/95 backdrop-blur-md"
          >
            <PopoverHeader
              title="Portrait Mode"
              description="Cinematic depth — blends a vignette around your screenshot."
              onReset={() =>
                setPortrait({
                  mode: "off",
                  intensity: 60,
                  position: 50,
                  distance: 50,
                })
              }
              resetTitle="Reset portrait"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {PORTRAIT_MODES.map((m) => {
                const active = portrait.mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setPortrait({ ...portrait, mode: m.id })}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-end overflow-hidden rounded-lg border bg-neutral-900 p-1.5 transition-all cursor-pointer",
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
            {portrait.mode !== "off" ? (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Intensity</span>
                    <EditableValue
                      value={portrait.intensity}
                      onChange={(v) => setPortrait({ ...portrait, intensity: v })}
                      min={0}
                      max={100}
                      suffix="%"
                    />
                  </div>
                  <Slider
                    value={[portrait.intensity]}
                    onValueChange={([v]) =>
                      setPortrait({ ...portrait, intensity: v })
                    }
                    max={100}
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Position</span>
                    <EditableValue
                      value={portrait.position}
                      onChange={(v) => setPortrait({ ...portrait, position: v })}
                      min={0}
                      max={100}
                    />
                  </div>
                  <Slider
                    value={[portrait.position]}
                    onValueChange={([v]) =>
                      setPortrait({ ...portrait, position: v })
                    }
                    max={100}
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Distance</span>
                    <EditableValue
                      value={portrait.distance}
                      onChange={(v) => setPortrait({ ...portrait, distance: v })}
                      min={0}
                      max={100}
                    />
                  </div>
                  <Slider
                    value={[portrait.distance]}
                    onValueChange={([v]) =>
                      setPortrait({ ...portrait, distance: v })
                    }
                    min={0}
                    max={100}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <BackdropTile icon={RiMagicLine} label="Filters" active={backdropFilter !== "none"} />
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            className="w-[260px] space-y-2 bg-popover/95 backdrop-blur-md"
          >
            <PopoverHeader
              title="Filters"
              description="Apply a colour grade to the background."
              onReset={() => setBackdropFilter("none")}
              resetTitle="Reset filter"
            />
            <BackdropFilterGrid current={backdropFilter} onChange={setBackdropFilter} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
