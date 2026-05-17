"use client"

import * as React from "react"
import { animate } from "motion/react"

import { AnnotationShapeElement } from "@/components/editor/annotation-shape-element"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import { CanvasBackdrop } from "@/components/editor/canvas/canvas-backdrop"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import {
  frameSelectionRadius,
  annotationPath,
} from "@/components/editor/canvas/helpers"
import { ScreenshotFrameContent } from "@/components/editor/canvas/screenshot-frame-content"
import {
  LAYOUT_PRESETS,
  PRESENT_PRESETS,
  resolvePresentPresetScale,
  type LayoutPreset,
  type PresentPreset,
} from "@/lib/editor/present-presets"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  RiArrowRightSLine,
  RiCheckLine,
  RiLayoutGridLine,
} from "@remixicon/react"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import {
  assetFilterCss,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  shadowCss,
  shadowDropFilterCss,
  screenshotPositionAnchor,
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  useSelectedScreenshotSlot,
  type AspectState,
  type CanvasState,
  type ScreenshotSlot,
  type Tilt,
  type ScreenshotPosition,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

function isSameTilt(a: Tilt, b: Tilt) {
  return a.rx === b.rx && a.ry === b.ry && a.rz === b.rz
}

function transformFromTiltAndScale(tilt: Tilt, scale: number) {
  return [
    "perspective(1400px)",
    `rotateX(${tilt.rx}deg)`,
    `rotateY(${tilt.ry}deg)`,
    `rotateZ(${tilt.rz}deg)`,
    `scale(${scale / 100})`,
  ].join(" ")
}

type PresetMotionKind = "canvas" | "slot"

const PRESET_MOTION_MS = 560

function motionVarName(
  kind: PresetMotionKind,
  axis: "rx" | "ry" | "rz" | "scale"
) {
  return `--${kind}-ts-${axis}`
}

function setMotionVars(
  el: HTMLElement,
  kind: PresetMotionKind,
  tilt: Tilt,
  scale: number
) {
  el.style.setProperty(motionVarName(kind, "rx"), `${tilt.rx}deg`)
  el.style.setProperty(motionVarName(kind, "ry"), `${tilt.ry}deg`)
  el.style.setProperty(motionVarName(kind, "rz"), `${tilt.rz}deg`)
  el.style.setProperty(motionVarName(kind, "scale"), String(scale / 100))
}

function clearMotionVars(el: HTMLElement, kind: PresetMotionKind) {
  el.style.removeProperty(motionVarName(kind, "rx"))
  el.style.removeProperty(motionVarName(kind, "ry"))
  el.style.removeProperty(motionVarName(kind, "rz"))
  el.style.removeProperty(motionVarName(kind, "scale"))
}

function mixNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function overshootNumber(from: number, to: number, amount: number) {
  const delta = to - from
  if (Math.abs(delta) < 0.001) return to
  return to + delta * amount
}

function startPresetMotion({
  target,
  kind,
  fromTilt,
  fromScale,
  toTilt,
  toScale,
}: {
  target: HTMLElement | null
  kind: PresetMotionKind
  fromTilt: Tilt
  fromScale: number
  toTilt: Tilt
  toScale: number
}) {
  if (!target) return () => undefined

  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  if (media.matches) return () => undefined

  const peakTilt: Tilt = {
    rx: overshootNumber(fromTilt.rx, toTilt.rx, 0.16),
    ry: overshootNumber(fromTilt.ry, toTilt.ry, 0.16),
    rz: overshootNumber(fromTilt.rz, toTilt.rz, 0.16),
  }
  const peakScale = overshootNumber(fromScale, toScale, 0.12)
  setMotionVars(target, kind, fromTilt, fromScale)

  const controls = animate(0, 1, {
    duration: PRESET_MOTION_MS / 1000,
    ease: [0.16, 1, 0.3, 1],
    onUpdate: (value) => {
      const firstLeg = value < 0.68
      const legProgress = firstLeg ? value / 0.68 : (value - 0.68) / 0.32
      const startTilt = firstLeg ? fromTilt : peakTilt
      const endTilt = firstLeg ? peakTilt : toTilt
      const startScale = firstLeg ? fromScale : peakScale
      const endScale = firstLeg ? peakScale : toScale

      setMotionVars(
        target,
        kind,
        {
          rx: mixNumber(startTilt.rx, endTilt.rx, legProgress),
          ry: mixNumber(startTilt.ry, endTilt.ry, legProgress),
          rz: mixNumber(startTilt.rz, endTilt.rz, legProgress),
        },
        mixNumber(startScale, endScale, legProgress)
      )
    },
  })

  const cleanupTimer = window.setTimeout(() => {
    clearMotionVars(target, kind)
  }, PRESET_MOTION_MS + 80)

  return () => {
    controls.stop()
    window.clearTimeout(cleanupTimer)
    clearMotionVars(target, kind)
  }
}

function useContainScale(
  ref: React.RefObject<HTMLElement | null>,
  width: number,
  height: number
) {
  const [scale, setScale] = React.useState(0.1)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setScale(Math.min(rect.width / width, rect.height / height))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [height, ref, width])

  return scale
}

type PresetTab = "single" | "multi"

function TabTriggerRow({
  tab,
  onTabChange,
}: {
  tab: PresetTab
  onTabChange: (t: PresetTab) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex h-11 w-full items-center gap-2.5 rounded-lg bg-secondary/40 px-3 text-left transition-colors hover:bg-secondary/70",
            open && "bg-secondary/70"
          )}
        >
          <span className="inline-flex size-5 items-center justify-center text-foreground/60">
            <RiLayoutGridLine className="size-4" />
          </span>
          <span className="flex-1 text-[13px] font-medium text-foreground capitalize">
            {tab === "single" ? "Single" : "Multi"}
          </span>
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[180px] p-1.5"
      >
        <div className="flex gap-1.5">
          {(["single", "multi"] as PresetTab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                onTabChange(t)
                setOpen(false)
              }}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors",
                tab === t
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
              )}
            >
              {t === "single" ? (
                <svg
                  width="44"
                  height="30"
                  viewBox="0 0 44 30"
                  fill="none"
                  className="shrink-0"
                >
                  <rect
                    x="8"
                    y="4"
                    width="28"
                    height="22"
                    rx="3"
                    fill="currentColor"
                    className={
                      tab === t ? "text-primary/40" : "text-foreground/20"
                    }
                  />
                  <rect
                    x="8"
                    y="4"
                    width="28"
                    height="22"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={
                      tab === t ? "text-primary/70" : "text-foreground/30"
                    }
                  />
                </svg>
              ) : (
                <svg
                  width="44"
                  height="30"
                  viewBox="0 0 44 30"
                  fill="none"
                  className="shrink-0"
                >
                  <rect
                    x="2"
                    y="6"
                    width="20"
                    height="18"
                    rx="2.5"
                    fill="currentColor"
                    className={
                      tab === t ? "text-primary/40" : "text-foreground/20"
                    }
                  />
                  <rect
                    x="2"
                    y="6"
                    width="20"
                    height="18"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={
                      tab === t ? "text-primary/70" : "text-foreground/30"
                    }
                  />
                  <rect
                    x="24"
                    y="9"
                    width="18"
                    height="15"
                    rx="2"
                    fill="currentColor"
                    className={
                      tab === t ? "text-primary/30" : "text-foreground/15"
                    }
                  />
                  <rect
                    x="24"
                    y="9"
                    width="18"
                    height="15"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={
                      tab === t ? "text-primary/60" : "text-foreground/25"
                    }
                  />
                </svg>
              )}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  tab === t ? "text-primary" : "text-muted-foreground"
                )}
              >
                {t === "single" ? "Single" : "Multi"}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PresentPresetsSection() {
  const canvas = useActiveCanvasField((c) => c)
  const activeCanvasId = useActiveCanvasId()
  const aspect = useEditorStore((s) => s.present.aspect)
  const selectedSlot = useSelectedScreenshotSlot()
  const setTiltAndScale = useEditorStore((s) => s.setTiltAndScale)
  const setScreenshotPosition = useEditorStore((s) => s.setScreenshotPosition)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const addScreenshotSlot = useEditorStore((s) => s.addScreenshotSlot)
  const activeTilt = selectedSlot?.tilt ?? canvas.tilt
  const activeScale = selectedSlot?.scale ?? canvas.scale
  const activeFrame = selectedSlot?.frame ?? canvas.frame
  const presetMotionCleanupRef = React.useRef<(() => void) | null>(null)
  const tab = useEditorStore((s) => s.presetTab)
  const setTab = useEditorStore((s) => s.setPresetTab)
  const activeLayoutPresetId = useEditorStore((s) => s.activeLayoutPresetId)
  const setActiveLayoutPresetId = useEditorStore(
    (s) => s.setActiveLayoutPresetId
  )

  const applyPreset = React.useCallback(
    (preset: PresentPreset) => {
      const scale = resolvePresentPresetScale(preset, activeFrame)
      presetMotionCleanupRef.current?.()
      const target =
        typeof document === "undefined"
          ? null
          : activeCanvasId
            ? document.querySelector<HTMLElement>(
                `[data-canvas-id="${activeCanvasId}"]`
              )
            : null
      presetMotionCleanupRef.current = startPresetMotion({
        target,
        kind: "canvas",
        fromTilt: activeTilt,
        fromScale: activeScale,
        toTilt: preset.tilt,
        toScale: scale,
      })
      setTiltAndScale(preset.tilt, scale)
      for (const slot of canvas.screenshotSlots) {
        const slotScale = resolvePresentPresetScale(preset, slot.frame)
        updateScreenshotSlot(slot.id, { tilt: preset.tilt, scale: slotScale })
      }
    },
    [
      activeCanvasId,
      activeFrame,
      activeScale,
      activeTilt,
      canvas.screenshotSlots,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  const setScreenshotOffset = useEditorStore((s) => s.setScreenshotOffset)

  const applyLayoutPreset = React.useCallback(
    (preset: LayoutPreset) => {
      setScreenshotPosition("center")
      const currentSlotIds = canvas.screenshotSlots.map((s) => s.id)
      const newSlotIds: string[] = []
      for (let i = currentSlotIds.length; i < preset.slots.length; i++) {
        const id = addScreenshotSlot()
        if (id) newSlotIds.push(id)
      }
      const allSlotIds = [...currentSlotIds, ...newSlotIds]
      for (let i = 0; i < preset.slots.length; i++) {
        const slotId = allSlotIds[i]
        const config = preset.slots[i]
        if (!slotId || !config) continue
        updateScreenshotSlot(slotId, {
          xPct: config.xPct,
          yPct: config.yPct,
          rotation: config.rotation,
          tilt: config.tilt,
          scale: config.scale,
        })
      }
      setTiltAndScale(preset.canvasTilt, preset.canvasScale)
      if (preset.mainOffset) {
        const aw = aspect.w || 16
        const ah = aspect.h || 10
        const canvasH = (BASE_CANVAS_WIDTH * ah) / aw
        setScreenshotOffset({
          x: (preset.mainOffset.xPct / 100) * BASE_CANVAS_WIDTH,
          y: (preset.mainOffset.yPct / 100) * canvasH,
        })
      }
      setActiveLayoutPresetId(preset.id)
    },
    [
      addScreenshotSlot,
      aspect,
      canvas.screenshotSlots,
      setActiveLayoutPresetId,
      setScreenshotOffset,
      setScreenshotPosition,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  React.useEffect(() => {
    return () => presetMotionCleanupRef.current?.()
  }, [])

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 bg-sidebar pb-1">
        <p className="mb-2 text-[13px] font-medium text-foreground">Presets</p>
        <TabTriggerRow tab={tab} onTabChange={setTab} />
      </div>

      {tab === "single" && (
        <div className="space-y-2">
          {PRESENT_PRESETS.map((preset) => {
            const scale = resolvePresentPresetScale(preset, activeFrame)
            const active =
              activeScale === scale && isSameTilt(activeTilt, preset.tilt)

            return (
              <div
                key={preset.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={preset.name}
                onClick={() => applyPreset(preset)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return
                  e.preventDefault()
                  applyPreset(preset)
                }}
                className={cn(
                  "group w-full cursor-pointer overflow-hidden rounded-[8px] border bg-white/[0.045] p-2 text-left transition-colors",
                  active
                    ? "border-primary ring-1 ring-primary/40"
                    : "border-white/12 hover:border-primary/55"
                )}
              >
                <div
                  aria-hidden
                  inert
                  className="relative isolate h-[176px] overflow-hidden rounded-[6px] [&_*]:pointer-events-none"
                >
                  <PresentPresetPreview
                    aspect={aspect}
                    canvas={canvas}
                    preset={preset}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] leading-tight font-medium">
                      {preset.name}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border text-white transition-opacity",
                      active
                        ? "border-primary/70 bg-primary/20 text-black opacity-100 dark:text-primary-foreground"
                        : "border-white/25 opacity-0 group-hover:opacity-70"
                    )}
                    aria-hidden
                  >
                    <RiCheckLine className="size-3" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === "multi" && (
        <div className="space-y-2">
          {LAYOUT_PRESETS.map((preset) => {
            const active = activeLayoutPresetId === preset.id
            return (
              <LayoutPresetCard
                key={preset.id}
                preset={preset}
                canvas={canvas}
                aspect={aspect}
                active={active}
                onApply={applyLayoutPreset}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function LayoutPresetCard({
  preset,
  canvas,
  aspect,
  active,
  onApply,
}: {
  preset: LayoutPreset
  canvas: CanvasState
  aspect: AspectState
  active: boolean
  onApply: (preset: LayoutPreset) => void
}) {
  // Build a virtual canvas that looks like the preset applied, for the preview
  const virtualCanvas = React.useMemo<CanvasState>(() => {
    const virtualSlots: ScreenshotSlot[] = preset.slots.map((cfg, i) => ({
      id: `_layout_preview_${i}`,
      src: canvas.screenshotSlots[i]?.src ?? null,
      xPct: cfg.xPct,
      yPct: cfg.yPct,
      widthPct: 60,
      heightPct: 28,
      rotation: cfg.rotation,
      padding: canvas.padding,
      tilt: cfg.tilt,
      scale: cfg.scale,
      frame: canvas.screenshotSlots[i]?.frame ?? { ...canvas.frame },
      borderRadius: canvas.borderRadius,
      zIndex: i + 1,
      shadow: { ...canvas.shadow },
      border: { ...canvas.border },
      enhance: canvas.enhance,
      filter: "none" as const,
      opacity: 100,
      blendMode: "normal" as const,
      frameAddress: canvas.frameAddress,
    }))
    const aw = aspect.w || 16
    const ah = aspect.h || 10
    const canvasH = (BASE_CANVAS_WIDTH * ah) / aw
    const offsetPx = preset.mainOffset
      ? {
          x: (preset.mainOffset.xPct / 100) * BASE_CANVAS_WIDTH,
          y: (preset.mainOffset.yPct / 100) * canvasH,
        }
      : { x: 0, y: 0 }
    return {
      ...canvas,
      screenshotSlots: virtualSlots,
      screenshotPosition: "center" as const,
      screenshotOffset: offsetPx,
    }
  }, [aspect, canvas, preset])

  const virtualPreset: PresentPreset = React.useMemo(
    () => ({
      id: preset.id,
      name: preset.name,
      tilt: preset.canvasTilt,
      scale: preset.canvasScale,
    }),
    [preset]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={preset.name}
      onClick={() => onApply(preset)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        onApply(preset)
      }}
      className={cn(
        "group w-full cursor-pointer overflow-hidden rounded-[8px] border bg-white/[0.045] p-2 text-left transition-colors",
        active
          ? "border-primary ring-1 ring-primary/40"
          : "border-white/12 hover:border-primary/55"
      )}
    >
      <div
        aria-hidden
        inert
        className="relative isolate h-[176px] overflow-hidden rounded-[6px] [&_*]:pointer-events-none"
      >
        <PresentPresetPreview
          aspect={aspect}
          canvas={virtualCanvas}
          preset={virtualPreset}
          useSlotOwnTilt
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[12px] leading-tight font-medium">
          {preset.name}
        </p>
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border text-white transition-opacity",
            active
              ? "border-primary/70 bg-primary/20 text-black opacity-100 dark:text-primary-foreground"
              : "border-white/25 opacity-0 group-hover:opacity-70"
          )}
          aria-hidden
        >
          <RiCheckLine className="size-3" />
        </span>
      </div>
    </div>
  )
}

function PresentPresetPreview({
  aspect,
  canvas,
  preset,
  useSlotOwnTilt = false,
}: {
  aspect: AspectState
  canvas: CanvasState
  preset: PresentPreset
  useSlotOwnTilt?: boolean
}) {
  const previewRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const nullCanvasRef = React.useRef<HTMLDivElement>(null)
  const effectsFilter = effectsFilterCss(canvas.backdrop.effects)
  const noiseEnabled = canvas.backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? canvas.backdrop.effects.noise / 100 : 0
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const canvasAspectRatio = aw / ah
  const stageWidth = BASE_CANVAS_WIDTH
  const stageHeight = (BASE_CANVAS_WIDTH * ah) / aw
  const previewScale = useContainScale(previewRef, stageWidth, stageHeight)
  const inRowMode = canvas.screenshotSlots.length > 0
  const rowLayoutItems = React.useMemo(
    () =>
      inRowMode
        ? computeRowLayout(
            [
              { id: "__main__", frame: canvas.frame },
              ...canvas.screenshotSlots.map((slot) => ({
                id: slot.id,
                frame: slot.frame,
              })),
            ],
            canvasAspectRatio
          )
        : null,
    [canvas.frame, canvas.screenshotSlots, canvasAspectRatio, inRowMode]
  )
  const mainRowLayout = rowLayoutItems ? rowLayoutItems[0] : null
  const screenshotAnchor = screenshotPositionAnchor(canvas.screenshotPosition)
  const slotRowLayoutById = React.useMemo(() => {
    if (!rowLayoutItems) return null
    const map = new Map<string, { widthPct: number; xPct: number }>()
    for (const item of rowLayoutItems.slice(1)) {
      map.set(item.id, { widthPct: item.widthPct, xPct: item.xPct })
    }
    return map
  }, [rowLayoutItems])
  const canvasTransform = transformFromTiltAndScale(
    preset.tilt,
    resolvePresentPresetScale(preset, canvas.frame)
  )

  return (
    <div ref={previewRef} className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden ring-1 ring-white/10 [contain:paint]"
        style={{
          width: stageWidth,
          height: stageHeight,
          borderRadius: canvas.canvasBorderRadius,
          transform: `translate(-50%, -50%) scale(${previewScale})`,
          transformOrigin: "center",
        }}
      >
        <CanvasBackdrop
          background={canvas.background}
          backdrop={canvas.backdrop}
          effectsFilter={effectsFilter}
          noiseEnabled={noiseEnabled}
          noiseOpacity={noiseOpacity}
          portrait={canvas.portrait}
          overlay={canvas.overlay}
        />
        {mainRowLayout ? (
          <PresentMainScreenshot
            canvas={canvas}
            transform={canvasTransform}
            screenshotOffset={canvas.screenshotOffset}
            screenshotPosition={canvas.screenshotPosition}
            screenshotAnchor={screenshotAnchor}
            stageRef={stageRef}
            imageRef={imageRef}
            canvasAspectRatio={canvasAspectRatio}
            rowLayout={mainRowLayout}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: `${(canvas.padding / 1200) * 100}%` }}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <CanvasFrameContent
                canvas={canvas}
                contentTransform={canvasTransform}
                screenshotAnchor={screenshotAnchor}
                screenshotOffset={canvas.screenshotOffset}
                stageRef={stageRef}
                imageRef={imageRef}
                aspectW={aw}
                aspectH={ah}
                emptyCompact={
                  preset.tilt.rx !== 0 ||
                  preset.tilt.ry !== 0 ||
                  preset.tilt.rz !== 0 ||
                  resolvePresentPresetScale(preset, canvas.frame) !== 100 ||
                  canvas.screenshotSlots.length > 0
                }
              />
            </div>
          </div>
        )}
        {canvas.screenshotSlots.map((slot) => (
          <PresentSlot
            key={slot.id}
            slot={slot}
            canvasAspectRatio={canvasAspectRatio}
            rowLayout={slotRowLayoutById?.get(slot.id) ?? null}
            previewTilt={useSlotOwnTilt ? undefined : preset.tilt}
            previewScale={
              useSlotOwnTilt
                ? undefined
                : resolvePresentPresetScale(preset, slot.frame)
            }
          />
        ))}
        {canvas.assets.map((a) => (
          <AssetElementView
            key={a.id}
            asset={a}
            canvasRef={nullCanvasRef}
            previewMode
          />
        ))}
        {canvas.texts.map((t) => (
          <TextElementView
            key={t.id}
            text={t}
            canvasRef={nullCanvasRef}
            previewMode
          />
        ))}
        {[...canvas.annotationShapes]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((shape) => (
            <AnnotationShapeElement
              key={shape.id}
              shape={shape}
              canvasRef={nullCanvasRef}
              previewMode
            />
          ))}
        {canvas.annotations
          .filter((s) => s.mode !== "eraser" && !s.hidden)
          .map((stroke) => (
            <svg
              key={stroke.id}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{
                zIndex: 60 + (stroke.zIndex ?? 0),
                mixBlendMode:
                  stroke.blendMode ??
                  (stroke.mode === "highlight" ? "multiply" : "normal"),
              }}
            >
              <path
                d={annotationPath(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={
                  ((stroke.opacity ?? 100) / 100) *
                  (stroke.mode === "highlight" ? 0.42 : 1)
                }
              />
            </svg>
          ))}
        {canvas.overlay.id !== null && canvas.overlay.position === "overlay" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${overlayUrl(canvas.overlay.id)}")`,
              opacity: canvas.overlay.opacity / 100,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function PresentMainScreenshot({
  canvas,
  transform,
  screenshotOffset,
  screenshotPosition,
  screenshotAnchor,
  stageRef,
  imageRef,
  canvasAspectRatio,
  rowLayout,
}: {
  canvas: CanvasState
  transform: string
  screenshotOffset: { x: number; y: number }
  screenshotPosition: ScreenshotPosition
  screenshotAnchor: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  canvasAspectRatio: number
  rowLayout: { widthPct: number; xPct: number }
}) {
  const left =
    screenshotPosition === "center"
      ? `${rowLayout.xPct}%`
      : `${screenshotAnchor.x}%`
  const top = screenshotPosition === "center" ? "50%" : `${screenshotAnchor.y}%`
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width: `${rowLayout.widthPct}%`,
        aspectRatio: slotBoxAspectRatio(canvas.frame, canvasAspectRatio),
        transform: `translate(-50%, -50%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px)`,
        zIndex: 60 + canvas.screenshotLayer.zIndex,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          padding: `${Math.max(0, Math.min(240, canvas.padding)) / 12}%`,
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            opacity: canvas.screenshotLayer.hidden
              ? 0
              : canvas.screenshotLayer.opacity / 100,
            mixBlendMode:
              canvas.screenshotLayer.blendMode !== "normal"
                ? canvas.screenshotLayer.blendMode
                : undefined,
            borderRadius: frameSelectionRadius(
              canvas.frame.id,
              canvas.borderRadius
            ),
          }}
        >
          <CanvasFrameContent
            canvas={canvas}
            contentTransform={transform}
            stageRef={stageRef}
            emptyCompact
            imageRef={imageRef}
          />
        </div>
      </div>
    </div>
  )
}

function CanvasFrameContent({
  canvas,
  contentTransform,
  screenshotAnchor,
  screenshotOffset,
  stageRef,
  imageRef,
  emptyCompact = false,
  aspectW,
  aspectH,
}: {
  canvas: CanvasState
  contentTransform: string
  screenshotAnchor?: { x: number; y: number }
  screenshotOffset?: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  emptyCompact?: boolean
  aspectW?: number
  aspectH?: number
}) {
  const enhanceFilter = enhanceFilterCss(canvas.enhance)
  const bareStyle: React.CSSProperties = {
    borderRadius: canvas.borderRadius,
    boxShadow: shadowCss(canvas.shadow),
    filter: enhanceFilter,
    transform: contentTransform,
    transformStyle: "preserve-3d",
  }
  if (canvas.border.color && canvas.border.width > 0) {
    bareStyle.outline = `${canvas.border.width}px ${canvas.border.style || "solid"} ${canvas.border.color}`
    bareStyle.outlineOffset = `${canvas.border.padding || 0}px`
  }

  return (
    <ScreenshotFrameContent
      src={canvas.screenshot}
      frame={canvas.frame}
      isDragOver={false}
      onBrowse={() => undefined}
      imageFilter={enhanceFilter}
      shadowFilter={shadowDropFilterCss(canvas.shadow)}
      contentTransform={contentTransform}
      bareStyle={bareStyle}
      activeTool="pointer"
      isDragging={false}
      stageRef={stageRef}
      imageRef={imageRef}
      addressValue={canvas.frameAddress}
      onAddressChange={() => undefined}
      onSelect={(e) => e.stopPropagation()}
      onPointerDown={() => undefined}
      onPointerMove={() => undefined}
      onPointerUp={() => undefined}
      onImageLoad={() => undefined}
      onCrop={() => undefined}
      onReplaceFile={() => undefined}
      onDelete={() => undefined}
      screenshotAnchor={screenshotAnchor}
      screenshotOffset={screenshotOffset}
      objectFit={canvas.objectFit ?? "contain"}
      applyTransformWhenEmpty
      emptyCompact={emptyCompact}
      aspectW={aspectW}
      aspectH={aspectH}
      mockupScopeToMinSide={canvas.screenshotSlots.length === 0}
    />
  )
}

function PresentSlot({
  slot,
  canvasAspectRatio,
  rowLayout,
  previewTilt,
  previewScale,
}: {
  slot: ScreenshotSlot
  canvasAspectRatio: number
  rowLayout: { widthPct: number; xPct: number } | null
  previewTilt?: Tilt
  previewScale?: number
}) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const effectiveWidthPct = rowLayout?.widthPct ?? slot.widthPct
  const filterChain = [
    enhanceFilterCss(slot.enhance),
    assetFilterCss(slot.filter),
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
  const bareStyle: React.CSSProperties = {
    borderRadius: slot.borderRadius,
    boxShadow: shadowCss(slot.shadow),
    filter: filterChain || undefined,
  }
  if (slot.border.color && slot.border.width > 0) {
    bareStyle.outline = `${slot.border.width}px ${slot.border.style || "solid"} ${slot.border.color}`
    bareStyle.outlineOffset = `${slot.border.padding || 0}px`
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${slot.xPct}%`,
        top: `${slot.yPct}%`,
        width: `${effectiveWidthPct}%`,
        aspectRatio: slotBoxAspectRatio(slot.frame, canvasAspectRatio),
        transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
        zIndex: 60 + slot.zIndex,
        display: slot.hidden ? "none" : undefined,
        mixBlendMode: slot.blendMode !== "normal" ? slot.blendMode : undefined,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ padding: `${Math.max(0, Math.min(240, slot.padding)) / 12}%` }}
      >
        <div
          className="relative h-full w-full"
          style={{
            opacity: slot.opacity / 100,
            borderRadius: frameSelectionRadius(
              slot.frame.id,
              slot.borderRadius
            ),
          }}
        >
          <ScreenshotFrameContent
            src={slot.src}
            frame={slot.frame}
            isDragOver={false}
            onBrowse={() => undefined}
            imageFilter={filterChain || undefined}
            shadowFilter={shadowDropFilterCss(slot.shadow)}
            contentTransform={transformFromTiltAndScale(
              previewTilt ?? slot.tilt,
              previewScale ?? slot.scale
            )}
            bareStyle={{
              ...bareStyle,
              transform: transformFromTiltAndScale(
                previewTilt ?? slot.tilt,
                previewScale ?? slot.scale
              ),
              transformStyle: "preserve-3d",
            }}
            activeTool="pointer"
            isDragging={false}
            stageRef={stageRef}
            imageRef={imageRef}
            addressValue={slot.frameAddress}
            onAddressChange={() => undefined}
            onSelect={(e) => e.stopPropagation()}
            onPointerDown={() => undefined}
            onPointerMove={() => undefined}
            onPointerUp={() => undefined}
            onImageLoad={() => undefined}
            onCrop={() => undefined}
            onReplaceFile={() => undefined}
            onDelete={() => undefined}
            objectFit={slot.objectFit ?? "contain"}
            applyTransformWhenEmpty
            emptyCompact
          />
        </div>
      </div>
    </div>
  )
}
