"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowRightLine,
  RiBrushLine,
  RiContrastLine,
  RiDropLine,
  RiEqualizerLine,
  RiFlashlightLine,
  RiFocus2Line,
  RiFocus3Line,
  RiGradienterLine,
  RiGridLine,
  RiLayoutGrid2Line,
  RiMacLine,
  RiMagicLine,
  RiMoonClearLine,
  RiPaletteLine,
  RiRefreshLine,
  RiLoader4Line,
  RiRotateLockLine,
  RiImageLine,
  RiSunLine,
  RiUnsplashLine,
  RiUpload2Line,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { EditableValue } from "@/components/editor/editable-value"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  BACKDROP_PATTERNS,
  BACKGROUND_LIBRARY,
  DEFAULT_IMAGE_BACKGROUND,
  GRADIENT_LIBRARY,
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  AUTO_PLACEHOLDER_GRADIENT,
  OVERLAY_COUNT,
  dynamicPatternColors,
  generateAutoGradients,
  overlayThumbUrl,
  patternCssFor,
  sampleImageColors,
  sampleImageColorsRaw,
  assetFilterCss,
  useEditor,
  type AssetFilter,
  type BackgroundEntry,
  type BgType,
  type PortraitMode,
} from "@/lib/editor/store"

const PORTRAIT_MODES: { id: PortraitMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "soft", label: "Soft" },
  { id: "studio", label: "Studio" },
  { id: "spot", label: "Spot" },
  { id: "frame", label: "Frame" },
  { id: "iris", label: "Iris" },
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
    default:
      return {}
  }
}

function PopoverHeader({
  title,
  description,
  onReset,
  resetTitle,
}: {
  title: string
  description: string
  onReset?: () => void
  resetTitle?: string
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-tight">
            {title}
          </span>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            {description}
          </p>
        </div>
        {onReset ? (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-0.5 size-6 shrink-0 cursor-pointer"
            onClick={onReset}
            title={resetTitle ?? "Reset"}
          >
            <RiArrowGoBackLine className="size-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
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
        "group relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-transparent text-foreground/80 transition-colors cursor-pointer hover:bg-background hover:text-foreground hover:border-border/70",
        "data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:border-border/70 data-[state=open]:shadow-sm",
        active && "text-foreground"
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
      {active ? (
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--sidebar)]" />
      ) : null}
    </button>
  )
}

export function Inspector({ className }: { className?: string }) {
  return (
    <aside className={cn("flex h-full min-h-0 w-[308px] shrink-0 flex-col border-l border-dashed border-border/70 bg-sidebar overflow-hidden", className)}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <span className="text-[13px] font-medium tracking-tight">
          Properties
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3 pb-24">
          <Section icon={RiPaletteLine} title="Background" defaultOpen>
            <BackgroundSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiSunLine} title="Backdrop">
            <BackdropSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiBrushLine} title="Border" defaultOpen>
            <BorderSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiLayoutGrid2Line} title="Padding" defaultOpen>
            <PaddingSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiRotateLockLine} title="Tilt & Scale" defaultOpen>
            <TiltSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiMoonClearLine} title="Shadow" defaultOpen>
            <ShadowSection />
          </Section>
        </div>
      </ScrollArea>
    </aside>
  )
}

/* -------- Section primitive -------- */

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1.5 text-left cursor-pointer"
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.18 }}
          className="inline-flex size-4 items-center justify-center text-muted-foreground"
        >
          <RiArrowDownSLine className="size-4" />
        </motion.span>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
          <Icon className="size-3" />
        </span>
        <span className="text-[13px] font-medium">{title}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1 pl-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SubHeader({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between text-[11px] tracking-tight text-muted-foreground">
      <span>{children}</span>
      {trailing}
    </div>
  )
}

/* -------- Backdrop -------- */

function BackdropSection() {
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
      <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/60 bg-secondary/30 p-1.5">
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
            onReset={() => setPortrait({ mode: "off", intensity: 60 })}
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
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-baseline justify-between">
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

    <div className="pt-2">
      <EffectSlider
        label="Canvas Radius"
        value={localRadius}
        onChange={(v) => {
          setLocalRadius(v)
          document.documentElement.style.setProperty("--canvas-border-radius", `${v}px`)
        }}
        onValueCommit={setCanvasBorderRadius}
        max={80}
      />
    </div>
  </div>
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

function EffectSlider({
  label,
  value,
  onChange,
  onValueCommit,
  min = 0,
  max = 100,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  onValueCommit?: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  const resolvedSuffix = suffix ?? (max === 100 ? "%" : "")
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <EditableValue
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          suffix={resolvedSuffix}
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onValueCommit ? ([v]) => onValueCommit(v) : undefined}
        min={min}
        max={max}
        className="cursor-pointer"
      />
    </div>
  )
}

/* -------- Background -------- */

type UnsplashResult = {
  id: string
  alt: string
  thumb: string
  full: string
  downloadLocation: string
  photographer: string
  photographerUrl: string
}

function BackgroundSection() {
  const { background, setBackground, screenshot } = useEditor()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [unsplashQuery, setUnsplashQuery] = React.useState("abstract gradient")
  const [unsplashStatus, setUnsplashStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")
  const [unsplashError, setUnsplashError] = React.useState<string | null>(null)
  const [unsplashResults, setUnsplashResults] = React.useState<
    UnsplashResult[]
  >([])
  const [unsplashOpen, setUnsplashOpen] = React.useState(false)
  const [autoResult, setAutoResult] = React.useState<{
    key: string
    gradients: string[]
    error: boolean
  } | null>(null)

  React.useEffect(() => {
    if (!screenshot) return
    let cancelled = false
    sampleImageColorsRaw(screenshot, 6)
      .then((colors) => {
        if (cancelled) return
        const gradients = generateAutoGradients(colors, 100)
        setAutoResult({
          key: screenshot,
          gradients,
          error: gradients.length === 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setAutoResult({ key: screenshot, gradients: [], error: true })
      })
    return () => {
      cancelled = true
    }
  }, [screenshot])

  const autoGradients =
    autoResult && screenshot && autoResult.key === screenshot
      ? autoResult.gradients
      : []
  const autoStatus: "idle" | "loading" | "ready" | "error" = !screenshot
    ? "idle"
    : !autoResult || autoResult.key !== screenshot
      ? "loading"
      : autoResult.error
        ? "error"
        : "ready"

  const onUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBackground({ type: "image", value: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  const searchUnsplash = async () => {
    const query = unsplashQuery.trim()
    if (!query) return

    setUnsplashStatus("loading")
    setUnsplashError(null)
    try {
      const response = await fetch(
        `/api/unsplash/search?q=${encodeURIComponent(query)}`
      )
      const data = (await response.json()) as
        | { results: UnsplashResult[] }
        | { error?: string }

      if (!response.ok || !("results" in data)) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to search Unsplash"
        )
      }

      setUnsplashResults(data.results)
      setUnsplashStatus("ready")
      setUnsplashOpen(true)
    } catch (error) {
      setUnsplashStatus("error")
      setUnsplashError(
        error instanceof Error ? error.message : "Unable to search Unsplash"
      )
    }
  }

  const selectUnsplashImage = (photo: UnsplashResult) => {
    setBackground({ type: "image", value: photo.full })
    setUnsplashOpen(false)
    void fetch(
      `/api/unsplash/download?url=${encodeURIComponent(photo.downloadLocation)}`
    )
  }

  const customSolid =
    background.type === "solid" && !SOLID_PRESETS.includes(background.value)
      ? background.value
      : null
  const [gradientOverrides, setGradientOverrides] = React.useState<Record<string, string>>({})
  const [autoGradientOverrides, setAutoGradientOverrides] = React.useState<Record<string, string>>({})
  const gradientOptions = React.useMemo(
    () => withGradientOptions({
      values: GRADIENT_PRESETS,
      valuePrefix: "preset",
      overrides: gradientOverrides,
    }),
    [gradientOverrides]
  )
  const gradientCategoryOptions = React.useMemo(
    () => {
      let cursor = 0
      return GRADIENT_LIBRARY.map((category) => {
        const slice = gradientOptions.slice(cursor, cursor + category.items.length)
        cursor += category.items.length
        return { key: category.key, label: category.label, options: slice }
      })
    },
    [gradientOptions]
  )
  const [gradientCategoryKey, setGradientCategoryKey] = React.useState<string>(() => {
    if (background.type === "gradient") {
      const found = GRADIENT_LIBRARY.find((c) =>
        c.items.includes(background.value)
      )
      if (found) return found.key
    }
    return GRADIENT_LIBRARY[0]?.key ?? "warm"
  })
  const [gradientExpanded, setGradientExpanded] = React.useState(false)
  const autoGradientOptions = React.useMemo(
    () => withGradientOptions({
      values: autoGradients,
      valuePrefix: "auto",
      overrides: autoGradientOverrides,
    }),
    [autoGradients, autoGradientOverrides]
  )
  const activeGradientOption = React.useMemo(
    () =>
      background.type === "gradient"
        ? gradientOptions.find((option) => option.value === background.value) ?? null
        : null,
    [background, gradientOptions]
  )
  const activeAutoGradientOption = React.useMemo(
    () =>
      background.type === "auto"
        ? autoGradientOptions.find((option) => option.value === background.value) ?? null
        : null,
    [background, autoGradientOptions]
  )
  const gradientConfig = React.useMemo(() => {
    if (background.type !== "gradient" && background.type !== "auto") return null
    const parsedGradient = parseLinearGradient(background.value)
    if (!parsedGradient) return null
    return {
      angle: parsedGradient.angle,
      colors: normalizeGradientColors(parsedGradient.colors, 4),
    }
  }, [background])

  const setGradientAngle = (angle: number) => {
    if (background.type !== "gradient" && background.type !== "auto") return
    const parsedGradient = parseLinearGradient(background.value) ?? DEFAULT_LINEAR_GRADIENT
    const normalizedColors = normalizeGradientColors(parsedGradient.colors, 4)
    const nextGradient = buildLinearGradient({
      angle,
      colors: normalizedColors,
    })
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => ({
        ...prev,
        [activeGradientOption.id]: nextGradient,
      }))
      setBackground({ type: "gradient", value: nextGradient })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => ({
      ...prev,
      [activeAutoGradientOption.id]: nextGradient,
    }))
    setBackground({ type: "auto", value: nextGradient })
  }

  const setGradientColor = ({
    colorIndex,
    colorValue,
  }: {
    colorIndex: number
    colorValue: string
  }) => {
    if (background.type !== "gradient" && background.type !== "auto") return
    const parsedGradient = parseLinearGradient(background.value) ?? DEFAULT_LINEAR_GRADIENT
    const normalizedColors = normalizeGradientColors(parsedGradient.colors, 4)
    if (colorIndex < 0 || colorIndex >= normalizedColors.length) return
    normalizedColors[colorIndex] = colorValue
    const nextGradient = buildLinearGradient({
      angle: parsedGradient.angle,
      colors: normalizedColors,
    })
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => ({
        ...prev,
        [activeGradientOption.id]: nextGradient,
      }))
      setBackground({ type: "gradient", value: nextGradient })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => ({
      ...prev,
      [activeAutoGradientOption.id]: nextGradient,
    }))
    setBackground({ type: "auto", value: nextGradient })
  }
  const resetGradientEdits = () => {
    if (background.type !== "gradient" && background.type !== "auto") return
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => {
        const next = { ...prev }
        delete next[activeGradientOption.id]
        return next
      })
      setBackground({ type: "gradient", value: activeGradientOption.baseValue })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => {
      const next = { ...prev }
      delete next[activeAutoGradientOption.id]
      return next
    })
    setBackground({ type: "auto", value: activeAutoGradientOption.baseValue })
  }
  const canResetGradient =
    background.type === "gradient"
      ? !!(activeGradientOption && activeGradientOption.value !== activeGradientOption.baseValue)
      : !!(activeAutoGradientOption && activeAutoGradientOption.value !== activeAutoGradientOption.baseValue)

  return (
    <div className="flex flex-col gap-6 pt-3">
      <Tabs
        value={background.type}
        onValueChange={(v) => {
          const type = v as BgType
          if (type === "none") setBackground({ type, value: "" })
          else if (type === "solid")
            setBackground({
              type,
              value:
                background.type === "solid"
                  ? background.value
                  : SOLID_PRESETS[0],
            })
          else if (type === "gradient")
            setBackground({
              type,
              value:
                background.type === "gradient"
                  ? background.value
                  : GRADIENT_PRESETS[0],
            })
          else if (type === "image")
            setBackground({
              type,
              value:
                background.type === "image"
                  ? background.value
                  : DEFAULT_IMAGE_BACKGROUND,
            })
          else if (type === "auto")
            setBackground({
              type,
              value:
                background.type === "auto"
                  ? background.value
                  : autoGradients[0] ?? AUTO_PLACEHOLDER_GRADIENT,
            })
        }}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-between bg-transparent p-0">
          <BgTabTrigger value="none" label="None">
            <div className="size-full bg-checker" />
          </BgTabTrigger>
          <BgTabTrigger value="auto" label="Auto">
            <div className="size-full bg-[conic-gradient(from_180deg_at_50%_50%,#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f472b6,#f87171)]" />
          </BgTabTrigger>
          <BgTabTrigger value="solid" label="Solid">
            <div className="size-full bg-white" />
          </BgTabTrigger>
          <BgTabTrigger value="gradient" label="Gradient">
            <div className="size-full bg-gradient-to-br from-primary/60 to-primary" />
          </BgTabTrigger>
          <BgTabTrigger value="image" label="Image">
            <RiImageLine className="size-4 text-muted-foreground group-data-[state=active]:text-foreground" />
          </BgTabTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-6 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ""
            }}
          />
          <div className="flex gap-2">
            <Popover open={unsplashOpen} onOpenChange={setUnsplashOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 flex-1 gap-2 bg-[#9BCD64] text-[#10220e] hover:bg-[#8ec25a] cursor-pointer"
                >
                  <RiUnsplashLine className="size-4" />
                  <span className="text-[11px] font-medium">Unsplash</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="left"
                align="start"
                sideOffset={10}
                className="w-[320px] space-y-3 border-border/60 bg-popover/95 p-3 backdrop-blur-md"
              >
                <div>
                  <p className="text-[12px] font-medium">Search Unsplash</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Pick a landscape photo as the canvas background.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    value={unsplashQuery}
                    onChange={(e) => setUnsplashQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void searchUnsplash()
                    }}
                    placeholder="Search backgrounds"
                    className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-secondary/30 px-3 text-[12px] outline-none transition-colors placeholder:text-muted-foreground focus:border-[#9BCD64]/70"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-[92px] cursor-pointer disabled:cursor-not-allowed"
                    onClick={searchUnsplash}
                    disabled={unsplashStatus === "loading"}
                  >
                    {unsplashStatus === "loading" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <RiLoader4Line className="size-3.5 animate-spin" />
                        Searching...
                      </span>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>
                {unsplashStatus === "error" ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                    {unsplashError}
                  </p>
                ) : null}
                <div className="grid max-h-[300px] grid-cols-3 gap-2 overflow-y-auto px-1 py-1 [scrollbar-width:thin]">
                  {unsplashResults.length > 0 ? (
                    unsplashResults.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => selectUnsplashImage(photo)}
                        title={`Photo by ${photo.photographer}`}
                        className={cn(
                          "aspect-square overflow-hidden rounded-lg border cursor-pointer transition-colors",
                          background.type === "image" &&
                            background.value === photo.full
                            ? "border-transparent ring-1 ring-[#9BCD64]/60 ring-offset-1 ring-offset-popover"
                            : "border-border/60 hover:border-foreground/30"
                        )}
                      >
                        <img
                          src={photo.thumb}
                          alt={photo.alt}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))
                  ) : (
                    <p className="col-span-3 rounded-lg border border-dashed border-border/60 px-3 py-8 text-center text-[11px] text-muted-foreground">
                      Search to load Unsplash photos.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="default"
              size="sm"
              className="h-9 flex-1 gap-2 cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <RiUpload2Line className="size-4" />
              <span className="text-[11px] font-medium">Upload</span>
            </Button>
          </div>

          <BackgroundLibrary
            activeUrl={background.type === "image" ? background.value : null}
            onSelect={(value) => setBackground({ type: "image", value })}
          />
        </TabsContent>

        <TabsContent value="gradient" className="mt-6">
          {(() => {
            const activeCategory =
              gradientCategoryOptions.find((c) => c.key === gradientCategoryKey) ??
              gradientCategoryOptions[0]
            if (!activeCategory) return null
            const items = activeCategory.options
            const visible = gradientExpanded
              ? items
              : items.slice(0, GRADIENT_PREVIEW_COUNT)
            const hidden = items.slice(GRADIENT_PREVIEW_COUNT)
            const peek = hidden[0] ?? null
            const showExpandTile = !gradientExpanded && hidden.length > 0
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary/40 p-1">
                  {gradientCategoryOptions.map((c) => {
                    const active = c.key === activeCategory.key
                    const CategoryIcon = gradientCategoryIcon(c.key)
                    return (
                      <button
                        key={c.key}
                        onClick={() => {
                          setGradientCategoryKey(c.key)
                          setGradientExpanded(false)
                        }}
                        className={cn(
                          "flex h-9 items-center justify-center gap-1.5 rounded-[5px] px-3 text-[11px] font-medium transition-colors cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <CategoryIcon className="size-3.5 shrink-0" />
                        {c.label}
                      </button>
                    )
                  })}
                </div>

                <div
                  className={cn(
                    "grid grid-cols-3 gap-2 px-1 py-1",
                    gradientExpanded &&
                      "max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:thin]"
                  )}
                >
                  {visible.map((option) => {
                    const active =
                      background.type === "gradient" &&
                      background.value === option.value
                    return (
                      <div key={option.id} className="relative">
                        <button
                          onClick={() =>
                            setBackground({ type: "gradient", value: option.value })
                          }
                          className={cn(
                            "aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                            active
                              ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                              : "border-border/60"
                          )}
                        >
                          <span
                            className="block size-full rounded-[inherit]"
                            style={{ background: option.value }}
                          />
                        </button>
                        {active && gradientConfig ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                aria-label="Customize gradient"
                                className="absolute inset-0 z-10 m-auto inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60 cursor-pointer"
                              >
                                <RiEqualizerLine className="size-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              side="bottom"
                              className="w-[300px] space-y-4 border-border/60 bg-popover/95 p-3"
                            >
                              <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[11px] text-muted-foreground">
                                    Angle
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <EditableValue
                                      value={Math.round(gradientConfig.angle)}
                                      onChange={setGradientAngle}
                                      min={0}
                                      max={360}
                                      suffix="deg"
                                    />
                                    <button
                                      aria-label="Reset gradient"
                                      disabled={!canResetGradient}
                                      onClick={resetGradientEdits}
                                      className={cn(
                                        "inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/30 text-muted-foreground transition-colors",
                                        canResetGradient
                                          ? "hover:border-foreground/30 hover:text-foreground cursor-pointer"
                                          : "opacity-40 cursor-not-allowed"
                                      )}
                                    >
                                      <RiRefreshLine className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <Slider
                                  value={[gradientConfig.angle]}
                                  onValueChange={([value]) => setGradientAngle(value)}
                                  min={0}
                                  max={360}
                                  className="cursor-pointer"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {GRADIENT_COLOR_CONTROLS.map(
                                  ({ id, label }, colorIndex) => (
                                    <ColorPickerPopover
                                      key={id}
                                      value={gradientConfig.colors[colorIndex]}
                                      onChange={(colorValue) =>
                                        setGradientColor({
                                          colorIndex,
                                          colorValue,
                                        })
                                      }
                                    >
                                      <button className="flex h-10 items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 text-left transition-colors hover:border-foreground/30 cursor-pointer">
                                        <span className="text-[11px] text-muted-foreground">
                                          {label}
                                        </span>
                                        <span
                                          className="size-5 rounded-full border border-border/60"
                                          style={{
                                            background:
                                              gradientConfig.colors[colorIndex],
                                          }}
                                        />
                                      </button>
                                    </ColorPickerPopover>
                                  )
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    )
                  })}
                  {showExpandTile ? (
                    <button
                      onClick={() => setGradientExpanded(true)}
                      title={`Show all ${items.length} ${activeCategory.label.toLowerCase()} gradients`}
                      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 cursor-pointer transition-colors hover:border-foreground/30"
                    >
                      {peek ? (
                        <span
                          className="block size-full scale-110 blur-sm"
                          style={{ background: peek.value }}
                        />
                      ) : (
                        <span className="block size-full bg-secondary/40" />
                      )}
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
                        <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        <span className="text-[9px] font-semibold">
                          +{hidden.length}
                        </span>
                      </span>
                    </button>
                  ) : null}
                </div>

                {gradientExpanded ? (
                  <button
                    onClick={() => setGradientExpanded(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Show less
                  </button>
                ) : null}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="solid" className="mt-6">
          <div className="grid grid-cols-3 gap-2 px-1 py-1">
            {SOLID_PRESETS.map((c) => {
              const active =
                background.type === "solid" && background.value === c
              return (
                <div key={c} className="relative">
                  <button
                    onClick={() => setBackground({ type: "solid", value: c })}
                    className={cn(
                      "aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                      active
                        ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                        : "border-border/60"
                    )}
                  >
                    <span
                      className="block size-full rounded-[inherit]"
                      style={{ background: c }}
                    />
                  </button>
                </div>
              )
            })}
            <div className="relative">
              <ColorPickerPopover
                value={customSolid || "#000000"}
                onChange={(hex) => setBackground({ type: "solid", value: hex })}
              >
                <button
                  className={cn(
                    "relative aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                    customSolid
                      ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                      : "border-border/60"
                  )}
                  aria-label="Custom color"
                >
                  <span
                    className="block size-full rounded-[inherit]"
                    style={{
                      background: customSolid || "transparent",
                      backgroundImage: customSolid
                        ? undefined
                        : "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)",
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/35 text-white">
                    <RiGradienterLine className="size-3.5" />
                  </span>
                </button>
              </ColorPickerPopover>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="none" className="mt-6">
          <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
            Transparent background
          </p>
        </TabsContent>

        <TabsContent value="auto" className="mt-6">
          {!screenshot ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Drop a screenshot to generate matching gradients
            </p>
          ) : autoStatus === "loading" ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Sampling colours from your screenshot…
            </p>
          ) : autoStatus === "error" || autoGradients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Couldn&apos;t read colours from this image
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 px-1 py-1">
              {autoGradientOptions.map((option) => {
                const active =
                  background.type === "auto" && background.value === option.value
                return (
                  <div key={option.id} className="relative">
                    <button
                      onClick={() => setBackground({ type: "auto", value: option.value })}
                      className={cn(
                        "aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                        active
                          ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                          : "border-border/60"
                      )}
                    >
                      <span
                        className="block size-full rounded-[inherit]"
                        style={{ background: option.value }}
                      />
                    </button>
                    {active && gradientConfig ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            aria-label="Customize auto gradient"
                            className="absolute inset-0 z-10 m-auto inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60 cursor-pointer"
                          >
                            <RiEqualizerLine className="size-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          side="bottom"
                          className="w-[300px] space-y-4 border-border/60 bg-popover/95 p-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[11px] text-muted-foreground">Angle</span>
                              <div className="flex items-center gap-2">
                                <EditableValue
                                  value={Math.round(gradientConfig.angle)}
                                  onChange={setGradientAngle}
                                  min={0}
                                  max={360}
                                  suffix="deg"
                                />
                                <button
                                  aria-label="Reset auto gradient"
                                  disabled={!canResetGradient}
                                  onClick={resetGradientEdits}
                                  className={cn(
                                    "inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/30 text-muted-foreground transition-colors",
                                    canResetGradient
                                      ? "hover:border-foreground/30 hover:text-foreground cursor-pointer"
                                      : "opacity-40 cursor-not-allowed"
                                  )}
                                >
                                  <RiRefreshLine className="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <Slider
                              value={[gradientConfig.angle]}
                              onValueChange={([value]) => setGradientAngle(value)}
                              min={0}
                              max={360}
                              className="cursor-pointer"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {GRADIENT_COLOR_CONTROLS.map(({ id, label }, colorIndex) => (
                              <ColorPickerPopover
                                key={id}
                                value={gradientConfig.colors[colorIndex]}
                                onChange={(colorValue) =>
                                  setGradientColor({
                                    colorIndex,
                                    colorValue,
                                  })}
                              >
                                <button className="flex h-10 items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 text-left transition-colors hover:border-foreground/30 cursor-pointer">
                                  <span className="text-[11px] text-muted-foreground">{label}</span>
                                  <span
                                    className="size-5 rounded-full border border-border/60"
                                    style={{ background: gradientConfig.colors[colorIndex] }}
                                  />
                                </button>
                              </ColorPickerPopover>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  )
}


function BgTabTrigger({ value, label, children }: { value: string; label: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="group flex h-auto flex-col items-center gap-2 bg-transparent p-0 border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-150 group-data-[state=active]:ring-2 group-data-[state=active]:ring-primary group-data-[state=active]:ring-offset-2 group-data-[state=active]:ring-offset-sidebar">
        {children}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground transition-colors group-data-[state=active]:text-foreground">
        {label}
      </span>
    </TabsTrigger>
  )
}

const BACKGROUND_PREVIEW_COUNT = 8
const GRADIENT_PREVIEW_COUNT = 8

function BackgroundLibrary({
  activeUrl,
  onSelect,
}: {
  activeUrl: string | null
  onSelect: (value: string) => void
}) {
  const categories = BACKGROUND_LIBRARY
  const [activeKey, setActiveKey] = React.useState<string>(() => {
    const found = categories.find((c) =>
      c.items.some((item) => item.full === activeUrl)
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
                "flex h-9 items-center justify-center gap-1.5 rounded-[5px] px-3 text-[11px] font-medium transition-colors cursor-pointer",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CategoryIcon className="size-3.5 shrink-0" />
              {c.label}
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          "grid grid-cols-3 gap-2 px-1 py-1",
          expanded && "max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:thin]"
        )}
      >
        {visible.map((item) => (
          <BackgroundTile
            key={item.id}
            item={item}
            active={activeUrl === item.full}
            onClick={() => onSelect(item.full)}
          />
        ))}
        {showExpandTile ? (
          <button
            onClick={() => setExpanded(true)}
            title={`Show all ${items.length} ${category.label.toLowerCase()} backgrounds`}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 cursor-pointer transition-colors hover:border-foreground/30"
          >
            {peek ? (
              <img
                src={peek.thumb}
                alt=""
                aria-hidden
                className="h-full w-full scale-110 object-cover blur-sm"
              />
            ) : (
              <div className="h-full w-full bg-secondary/40" />
            )}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
              <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              <span className="text-[9px] font-semibold">+{hidden.length}</span>
            </span>
          </button>
        ) : null}
      </div>

      {expanded ? (
        <button
          onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Show less
        </button>
      ) : null}
    </div>
  )
}

function gradientCategoryIcon(key: string) {
  switch (key) {
    case "warm":
      return RiSunLine
    case "cool":
      return RiMoonClearLine
    case "vivid":
      return RiFlashlightLine
    case "mono":
      return RiContrastLine
    case "pastel":
      return RiDropLine
    default:
      return RiGradienterLine
  }
}

function backgroundCategoryIcon(key: string) {
  switch (key) {
    case "mesh":
      return RiGridLine
    case "lines":
      return RiEqualizerLine
    case "gradient":
      return RiGradienterLine
    case "raycast":
      return RiFocus2Line
    case "mac":
      return RiMacLine
    default:
      return RiImageLine
  }
}

function BackgroundTile({
  item,
  active,
  onClick,
}: {
  item: BackgroundEntry
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={item.name}
      className={cn(
        "aspect-square overflow-hidden rounded-lg border cursor-pointer transition-colors",
        active
          ? "border-transparent ring-1 ring-primary/40 ring-offset-1 ring-offset-sidebar"
          : "border-border/60 hover:border-foreground/30"
      )}
    >
      <img
        src={item.thumb}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </button>
  )
}

function parseLinearGradient(gradientValue: string): {
  angle: number
  colors: string[]
} | null {
  if (!gradientValue.startsWith("linear-gradient(") || !gradientValue.endsWith(")")) return null
  const gradientBody = gradientValue.slice("linear-gradient(".length, -1)
  const parts = splitByTopLevelComma(gradientBody)
  if (parts.length < 3) return null
  const angleMatch = parts[0].trim().match(/(-?\d+(\.\d+)?)deg/)
  const angle = angleMatch ? Number.parseFloat(angleMatch[1]) : DEFAULT_LINEAR_GRADIENT.angle
  const colors = parts
    .slice(1)
    .map((part) => part.trim().replace(/\s+\d+%$/g, ""))
    .filter(Boolean)
  if (colors.length < 2) return null
  return { angle, colors }
}

function splitByTopLevelComma(value: string): string[] {
  const parts: string[] = []
  let currentValue = ""
  let depth = 0
  for (const char of value) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      parts.push(currentValue)
      currentValue = ""
      continue
    }
    currentValue += char
  }
  if (currentValue.trim()) parts.push(currentValue)
  return parts
}

function normalizeGradientColors(colors: string[], targetLength: number): string[] {
  const safeColors = colors.length > 0 ? colors.slice(0, targetLength) : [...DEFAULT_LINEAR_GRADIENT.colors]
  while (safeColors.length < targetLength) {
    safeColors.push(safeColors[safeColors.length - 1] ?? DEFAULT_LINEAR_GRADIENT.colors[0])
  }
  return safeColors
}

function buildLinearGradient({
  angle,
  colors,
}: {
  angle: number
  colors: string[]
}): string {
  return `linear-gradient(${Math.round(angle)}deg, ${colors.join(", ")})`
}

const DEFAULT_LINEAR_GRADIENT = {
  angle: 135,
  colors: ["#60a5fa", "#a78bfa", "#34d399", "#f472b6"],
}

const GRADIENT_COLOR_CONTROLS = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "accent", label: "Accent" },
  { id: "foreground", label: "Foreground" },
]

function withGradientOptions({
  values,
  valuePrefix,
  overrides,
}: {
  values: string[]
  valuePrefix: string
  overrides: Record<string, string>
}): GradientOption[] {
  return values.map((value, index) => {
    const id = `${valuePrefix}-${index}`
    return {
      id,
      baseValue: value,
      value: overrides[id] ?? value,
    }
  })
}

interface GradientOption {
  id: string
  baseValue: string
  value: string
}

/* -------- Padding -------- */

function PaddingSection() {
  const { padding, setPadding } = useEditor()
  const quick = [16, 40, 80, 120]
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Inset</span>
        <EditableValue
          value={padding}
          onChange={setPadding}
          min={0}
          max={240}
          suffix="px"
        />
      </div>
      <Slider
        value={[padding]}
        onValueChange={([v]) => setPadding(v)}
        max={240}
        className="mb-3 cursor-pointer"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setPadding(q)}
            className={cn(
              "tabular h-8 rounded-md border font-mono text-[11px] transition-colors cursor-pointer",
              padding === q
                ? "border-primary/30 bg-primary text-white"
                : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-foreground/25"
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </>
  )
}

/* -------- Border -------- */

const BORDER_PRESETS = [
  "#f08a9a", // strawberry
  "#fde2e4", // strawberry blush
  "#92b97a", // matcha
  "#cfe5b8", // matcha mist
  "#0f172a", // ink
  "#ffffff", // white
]

const DEFAULT_BORDER_COLOR = BORDER_PRESETS[0]

function BorderSection() {
  const { border, setBorder, borderRadius, setBorderRadius, background, screenshot } = useEditor()
  const enabled = border.color !== null
  const currentColor = border.color || DEFAULT_BORDER_COLOR

  const [dynamicColors, setDynamicColors] = React.useState<string[]>([])

  React.useEffect(() => {
    let active = true
    async function loadColors() {
      let url = null
      if (background.type === "image") {
        url = background.value
      } else if (screenshot) {
        url = screenshot
      }

      if (url) {
        try {
          const colors = await sampleImageColorsRaw(url, 4)
          if (active) setDynamicColors(colors)
        } catch {
          if (active) setDynamicColors([])
        }
      } else if (background.type === "gradient" || background.type === "solid") {
        const matches = background.value.match(/#[0-9a-fA-F]{3,8}/g) ?? []
        if (active) setDynamicColors(matches.slice(0, 4))
      } else {
        if (active) setDynamicColors([])
      }
    }
    loadColors()
    return () => {
      active = false
    }
  }, [background, screenshot])

  const presets = dynamicColors.length > 0
    ? ["#ffffff", "#0f172a", ...dynamicColors]
    : [...BORDER_PRESETS]

  while (presets.length < 6) {
    presets.push(BORDER_PRESETS[presets.length])
  }
  const finalPresets = presets.slice(0, 6)

  const isCustom =
    enabled &&
    !finalPresets.some((c) => c.toLowerCase() === currentColor.toLowerCase())

  const thumbBg = "bg-[#d1d5db]"
  
  const borderStyles = [
    { id: "solid" as const, label: "Solid", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[3px] border-solid border-gray-500" />
      </div>
    )},
    { id: "dashed" as const, label: "Dashed", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[3px] border-dashed border-gray-500" />
      </div>
    )},
    { id: "dotted" as const, label: "Dotted", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[3px] border-dotted border-gray-500" />
      </div>
    )},
    { id: "double" as const, label: "Double", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[4px] border-double border-gray-500" />
      </div>
    )},
    { id: "groove" as const, label: "Groove", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[3px] border-groove border-gray-500" />
      </div>
    )},
    { id: "ridge" as const, label: "Ridge", icon: (
      <div className={cn("size-full rounded-sm p-2", thumbBg)}>
        <div className="size-full rounded-[3px] border-[3px] border-ridge border-gray-500" />
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Radius</span>
          <EditableValue
            value={borderRadius}
            onChange={setBorderRadius}
            min={0}
            max={48}
            suffix="px"
          />
        </div>
        <Slider
          value={[borderRadius]}
          onValueChange={([v]) => setBorderRadius(v)}
          max={48}
          className="cursor-pointer"
        />
      </div>

      <div className="h-px bg-border/40" />

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Border</span>
        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={(on) =>
            setBorder({ ...border, color: on ? DEFAULT_BORDER_COLOR : null })
          }
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Width</span>
          <EditableValue
            value={border.width}
            onChange={(v) => setBorder({ ...border, width: v })}
            min={0}
            max={12}
            suffix="px"
          />
        </div>
        <Slider
          value={[border.width]}
          onValueChange={([v]) => setBorder({ ...border, width: v })}
          min={0}
          max={12}
          className="cursor-pointer"
        />
      </div>

      <div>
        <SubHeader>Style</SubHeader>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {borderStyles.map((t) => (
            <button
              key={t.id}
              onClick={() => setBorder({ ...border, style: t.id })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all cursor-pointer",
                (border.style || "solid") === t.id
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-secondary/20 hover:border-foreground/30"
              )}
            >
              <div className="aspect-square w-full">{t.icon}</div>
              <span className={cn(
                "text-[9px] font-medium",
                (border.style || "solid") === t.id ? "text-primary" : "text-muted-foreground"
              )}>{t.label}</span>
            </button>
          ))}
        </div>
        <SubHeader>Color</SubHeader>
        <div className="grid grid-cols-3 gap-2 px-1 py-1">
          {finalPresets.map((c, i) => {
            const active =
              enabled && currentColor.toLowerCase() === c.toLowerCase()
            return (
              <div key={c} className="relative">
                <button
                  key={c + i}
                  onClick={() => setBorder({ ...border, color: c })}
                  className={cn(
                    "aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                    active
                      ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                      : "border-border/60"
                  )}
                >
                  <span
                    className="block size-full rounded-[inherit]"
                    style={{ background: c }}
                  />
                </button>
              </div>
            )
          })}
          <div className="relative">
            <ColorPickerPopover
              value={isCustom ? currentColor : DEFAULT_BORDER_COLOR}
              onChange={(hex) => setBorder({ ...border, color: hex })}
            >
              <button
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                  isCustom
                    ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                    : "border-border/60"
                )}
                aria-label="Custom border color"
              >
                <span
                  className="block size-full rounded-[inherit]"
                  style={{
                    background: isCustom ? currentColor : "transparent",
                    backgroundImage: isCustom
                      ? undefined
                      : "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/35 text-white">
                  <RiGradienterLine className="size-3.5" />
                </span>
              </button>
            </ColorPickerPopover>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------- Tilt & Scale -------- */

function TiltSection() {
  const { tilt, setTilt, scale, setScale } = useEditor()
  return (
    <>
      <DegreeRow
        label="Rotate X"
        value={tilt.rx}
        onChange={(v) => setTilt({ ...tilt, rx: v })}
      />
      <DegreeRow
        label="Rotate Y"
        value={tilt.ry}
        onChange={(v) => setTilt({ ...tilt, ry: v })}
      />
      <DegreeRow
        label="Rotate Z"
        value={tilt.rz}
        onChange={(v) => setTilt({ ...tilt, rz: v })}
      />
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Scale</span>
        <EditableValue
          value={scale}
          onChange={setScale}
          min={10}
          max={300}
          suffix="%"
        />
      </div>
      <Slider
        value={[scale]}
        onValueChange={([v]) => setScale(v)}
        min={50}
        max={150}
        className="cursor-pointer"
      />
    </>
  )
}

function DegreeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <EditableValue
          value={value}
          onChange={onChange}
          min={-180}
          max={180}
          suffix="°"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={-45}
        max={45}
        className="cursor-pointer"
      />
    </div>
  )
}

const SHADOW_COLOR_PRESETS = [
  "#000000",
  "#1e293b",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
]

/* -------- Shadow -------- */

function ShadowSection() {
  const { shadow, setShadow } = useEditor()
  const { type, intensity, lightSource, color = "#000000" } = shadow

  const setType = (t: typeof shadow.type) => {
    if (t === "hard") {
      setShadow({ ...shadow, type: t, intensity: 100, lightSource: "2-0" })
      return
    }
    setShadow({ ...shadow, type: t })
  }
  const setIntensity = (n: number) => setShadow({ ...shadow, intensity: n })
  const setLightSource = (id: string) => setShadow({ ...shadow, lightSource: id })
  const setColor = (c: string) => setShadow({ ...shadow, color: c })

  const thumbBg = "bg-[#d1d5db]"
  const thumbCard = "rounded-[3px] bg-white"

  const types = [
    { id: "none" as const, label: "None", icon: (
      <div className={cn("size-full rounded-sm p-3", thumbBg)}>
        <div className="size-full rounded-[3px] border-2 border-dashed border-gray-400" />
      </div>
    )},
    { id: "drop" as const, label: "Drop", icon: (
      <div className={cn("size-full rounded-sm p-3 pb-4 pr-4", thumbBg)}>
        <div className={cn("size-full shadow-[5px_5px_8px_0px_rgba(0,0,0,0.45)]", thumbCard)} />
      </div>
    )},
    { id: "soft" as const, label: "Soft", icon: (
      <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
        <div className={cn("size-full shadow-[0_8px_20px_2px_rgba(0,0,0,0.3)]", thumbCard)} />
      </div>
    )},
    { id: "hard" as const, label: "Hard", icon: (
      <div className={cn("size-full rounded-sm p-3 pb-4 pr-4", thumbBg)}>
        <div className={cn("size-full shadow-[5px_5px_0px_0px_rgba(0,0,0,0.75)]", thumbCard)} />
      </div>
    )},
    { id: "glow" as const, label: "Glow", icon: (
      <div className={cn("size-full rounded-sm p-3", thumbBg)}>
        <div className={cn("size-full shadow-[0_0_14px_3px_rgba(0,0,0,0.35)]", thumbCard)} />
      </div>
    )},
    { id: "float" as const, label: "Float", icon: (
      <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
        <div className={cn("size-full shadow-[0_4px_6px_0px_rgba(0,0,0,0.25),0_12px_20px_0px_rgba(0,0,0,0.2)]", thumbCard)} />
      </div>
    )},
  ]

  const isDisabled = type === "none"
  const lightSourceDisabled = isDisabled || type === "glow" || type === "float"
  const isCustomColor = !SHADOW_COLOR_PRESETS.includes(color)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all cursor-pointer",
              type === t.id
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div className="aspect-square w-full">{t.icon}</div>
            <span className={cn(
              "text-[9px] font-medium",
              type === t.id ? "text-primary" : "text-muted-foreground"
            )}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={cn(isDisabled && "pointer-events-none opacity-50")}>
        <SubHeader>Color</SubHeader>
        <div className="grid grid-cols-3 gap-2 px-1 py-1">
          {SHADOW_COLOR_PRESETS.map((c) => {
            const active = color === c && !isCustomColor
            return (
              <div key={c} className="relative">
                <button
                  onClick={() => setColor(c)}
                  className={cn(
                    "aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                    active
                      ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                      : "border-border/60"
                  )}
                >
                  <span className="block size-full rounded-[inherit]" style={{ background: c }} />
                </button>
              </div>
            )
          })}
          <div className="relative">
            <ColorPickerPopover value={isCustomColor ? color : "#000000"} onChange={setColor}>
              <button
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-xl border cursor-pointer",
                  isCustomColor
                    ? "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
                    : "border-border/60"
                )}
                aria-label="Custom shadow color"
              >
                <span
                  className="block size-full rounded-[inherit]"
                  style={{
                    background: isCustomColor ? color : "transparent",
                    backgroundImage: isCustomColor
                      ? undefined
                      : "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/35 text-white">
                  <RiGradienterLine className="size-3.5" />
                </span>
              </button>
            </ColorPickerPopover>
          </div>
        </div>
      </div>

      <div className={cn(isDisabled && "pointer-events-none opacity-50")}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Intensity</span>
          <EditableValue
            value={intensity}
            onChange={setIntensity}
            min={0}
            max={100}
            suffix="%"
          />
        </div>
        <Slider value={[intensity]} onValueChange={([v]) => setIntensity(v)} max={100} className="cursor-pointer" />
      </div>

      <div className={cn(lightSourceDisabled && "pointer-events-none opacity-50")}>
        <SubHeader>Light Source</SubHeader>
        <div className="mt-2">
          <div className="grid grid-cols-5 gap-1.5 w-full">
            {LIGHT_POSITIONS.map((pos) => {
              const isActive = lightSource === pos.id
              return (
                <button
                  key={pos.id}
                  onClick={() => setLightSource(pos.id)}
                  className={cn(
                    "flex w-full aspect-square items-center justify-center rounded-md border transition-all cursor-pointer",
                    isActive
                      ? "border-primary bg-primary text-white"
                      : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {pos.isCenter ? (
                    <RiFocus3Line className="size-3.5" />
                  ) : (
                    <RiArrowRightLine
                      className="size-3.5"
                      style={{ transform: `rotate(${pos.angle}deg)` }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const LIGHT_POSITIONS = Array.from({ length: 25 }, (_, i) => {
  const r = Math.floor(i / 5)
  const c = i % 5
  const dx = c - 2
  const dy = r - 2
  const isCenter = dx === 0 && dy === 0
  return {
    id: isCenter ? "center" : `${r}-${c}`,
    isCenter,
    angle: isCenter ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI,
  }
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
    <div className="grid grid-cols-4 gap-1.5">
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
