"use client"

import * as React from "react"
import { animate, AnimatePresence, motion } from "motion/react"

import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import {
  LAYOUT_PRESETS,
  PRESENT_PRESETS,
  layoutPresetDeviceClassForFrame,
  resolveLayoutPresetGeometry,
  resolvePresentPresetScale,
  type LayoutPreset,
  type PresentPreset,
} from "@/lib/editor/present-presets"
import { computeRowLayout } from "@/lib/editor/screenshot-layout"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  RiArrowRightSLine,
  RiCheckLine,
  RiFileCopyLine,
  RiLayoutGridLine,
} from "@remixicon/react"
import { toast } from "sonner"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  useSelectedScreenshotSlot,
  type AspectState,
  type CanvasState,
  type ScreenshotSlot,
  type Tilt,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type PresetMotionKind = "canvas" | "slot"

const PRESET_MOTION_MS = 560

function canvasDimsFromAspect(aspect: AspectState) {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  return {
    width: BASE_CANVAS_WIDTH,
    height: (BASE_CANVAS_WIDTH * ah) / aw,
  }
}

function roundLayoutNumber(value: number) {
  return Number(value.toFixed(2))
}

function buildLayoutPresetCapture({
  canvas,
  aspect,
  activeLayoutPresetId,
}: {
  canvas: CanvasState
  aspect: AspectState
  activeLayoutPresetId: string | null
}) {
  const dims = canvasDimsFromAspect(aspect)
  const mainOffset = {
    xPct: roundLayoutNumber((canvas.screenshotOffset.x / dims.width) * 100),
    yPct: roundLayoutNumber((canvas.screenshotOffset.y / dims.height) * 100),
  }
  const slots = canvas.screenshotSlots.map((slot, index) => ({
    index,
    id: slot.id,
    xPct: roundLayoutNumber(slot.xPct),
    yPct: roundLayoutNumber(slot.yPct),
    widthPct: roundLayoutNumber(slot.widthPct),
    heightPct: roundLayoutNumber(slot.heightPct),
    rotation: roundLayoutNumber(slot.rotation),
    tilt: {
      rx: roundLayoutNumber(slot.tilt.rx),
      ry: roundLayoutNumber(slot.tilt.ry),
      rz: roundLayoutNumber(slot.tilt.rz),
    },
    scale: roundLayoutNumber(slot.scale),
  }))
  const presetPatch = {
    canvasTilt: {
      rx: roundLayoutNumber(canvas.tilt.rx),
      ry: roundLayoutNumber(canvas.tilt.ry),
      rz: roundLayoutNumber(canvas.tilt.rz),
    },
    canvasScale: roundLayoutNumber(canvas.scale),
    slots: slots.map(({ xPct, yPct, rotation, tilt, scale }) => ({
      xPct,
      yPct,
      rotation,
      tilt,
      scale,
    })),
    mainOffset,
  }

  return {
    type: "layout-preset-capture-v1",
    activeLayoutPresetId,
    layoutDeviceClass: layoutPresetDeviceClassForFrame(canvas.frame),
    frame: {
      id: canvas.frame.id,
      orientation: canvas.frame.orientation,
    },
    aspect: {
      id: aspect.id,
      w: aspect.w || 16,
      h: aspect.h || 10,
    },
    screenshotPosition: canvas.screenshotPosition,
    presetPatch,
    slots,
  }
}

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
        forceMount
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[180px] overflow-visible border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-[180px] rounded-lg bg-popover p-1.5 shadow-md ring-1 ring-foreground/10"
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
            </motion.div>
          )}
        </AnimatePresence>
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
  const activeSinglePresetId = useEditorStore((s) => s.activeSinglePresetId)
  const setActiveSinglePresetId = useEditorStore(
    (s) => s.setActiveSinglePresetId
  )
  const copyCurrentLayout = React.useCallback(async () => {
    const capture = buildLayoutPresetCapture({
      canvas,
      aspect,
      activeLayoutPresetId,
    })
    try {
      await navigator.clipboard.writeText(JSON.stringify(capture, null, 2))
      toast.success("Preset coordinates copied")
    } catch (error) {
      console.error(error)
      toast.error("Could not copy preset coordinates")
    }
  }, [activeLayoutPresetId, aspect, canvas])

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
      setActiveSinglePresetId(preset.id)
    },
    [
      activeCanvasId,
      activeFrame,
      activeScale,
      activeTilt,
      canvas.screenshotSlots,
      setActiveSinglePresetId,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  const setScreenshotOffset = useEditorStore((s) => s.setScreenshotOffset)

  const applyLayoutPreset = React.useCallback(
    (preset: LayoutPreset) => {
      const geometry = resolveLayoutPresetGeometry(preset, canvas.frame)
      setScreenshotPosition("center")
      const currentSlotIds = canvas.screenshotSlots.map((s) => s.id)
      const newSlotIds: string[] = []
      for (let i = currentSlotIds.length; i < geometry.slots.length; i++) {
        const id = addScreenshotSlot()
        if (id) newSlotIds.push(id)
      }
      const allSlotIds = [...currentSlotIds, ...newSlotIds]
      // Compute natural row positions so relative presets can offset from them
      const aw = aspect.w || 16
      const ah = aspect.h || 10
      const canvasAspect = aw / ah
      const naturalLayout = computeRowLayout(
        [
          { id: "__main__", frame: canvas.frame },
          ...allSlotIds.map((id) => ({ id, frame: canvas.frame })),
        ],
        canvasAspect
      )
      for (let i = 0; i < geometry.slots.length; i++) {
        const slotId = allSlotIds[i]
        const config = geometry.slots[i]
        if (!slotId || !config) continue
        const naturalSlotX = naturalLayout[i + 1]?.xPct ?? 75
        const xPct = geometry.relativeSlotPositions
          ? naturalSlotX + config.xPct
          : config.xPct
        const yPct = geometry.relativeSlotPositions ? 50 + config.yPct : config.yPct
        updateScreenshotSlot(slotId, {
          xPct,
          yPct,
          rotation: config.rotation,
          tilt: config.tilt,
          scale: config.scale,
        })
      }
      setTiltAndScale(geometry.canvasTilt, geometry.canvasScale)
      if (geometry.mainOffset) {
        const PRESET_DESIGN_HEIGHT = BASE_CANVAS_WIDTH * (10 / 16)
        setScreenshotOffset({
          x: (geometry.mainOffset.xPct / 100) * BASE_CANVAS_WIDTH,
          y: (geometry.mainOffset.yPct / 100) * PRESET_DESIGN_HEIGHT,
        })
      }
      setActiveLayoutPresetId(preset.id)
    },
    [
      addScreenshotSlot,
      aspect,
      canvas.frame,
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-foreground">Presets</p>
          <button
            type="button"
            onClick={() => void copyCurrentLayout()}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.045] px-2 text-[11px] font-medium text-foreground/75 transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-foreground"
            title="Copy current layout coordinates"
            aria-label="Copy current layout coordinates"
          >
            <RiFileCopyLine className="size-3.5" />
            Temp copy
          </button>
        </div>
        <TabTriggerRow tab={tab} onTabChange={setTab} />
      </div>

      {tab === "single" && (
        <div className="space-y-2">
          {PRESENT_PRESETS.map((preset) => {
            const active = activeSinglePresetId === preset.id

            return (
              <SinglePresetCard
                key={preset.id}
                preset={preset}
                canvas={canvas}
                aspect={aspect}
                active={active}
                onApply={applyPreset}
              />
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

/**
 * Defer the heavy preview render until the card scrolls near the viewport.
 * Combined with `content-visibility: auto`, this keeps fast scrolling smooth
 * by letting the browser skip layout/paint of off-screen cards entirely.
 */
function useDeferredVisibility(
  ref: React.RefObject<HTMLElement | null>,
  rootMargin = "300px"
) {
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])
  return visible
}

const PresetCardShell = React.memo(function PresetCardShell({
  active,
  ariaLabel,
  onApply,
  aspectStyle,
  intrinsicSize,
  name,
  children,
}: {
  active: boolean
  ariaLabel: string
  onApply: () => void
  aspectStyle: React.CSSProperties
  intrinsicSize: string
  name: string
  children: React.ReactNode
}) {
  const shellRef = React.useRef<HTMLDivElement>(null)
  const visible = useDeferredVisibility(shellRef)

  return (
    <div
      ref={shellRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        onApply()
      }}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: intrinsicSize,
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
        className="relative isolate w-full overflow-hidden rounded-[6px] [&_*]:pointer-events-none"
        style={aspectStyle}
      >
        {visible ? children : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[12px] leading-tight font-medium">{name}</p>
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
})

const SinglePresetCard = React.memo(function SinglePresetCard({
  preset,
  canvas,
  aspect,
  active,
  onApply,
}: {
  preset: PresentPreset
  canvas: CanvasState
  aspect: AspectState
  active: boolean
  onApply: (preset: PresentPreset) => void
}) {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const aspectStyle: React.CSSProperties = {
    aspectRatio: `${aw} / ${ah}`,
  }
  const handleApply = React.useCallback(
    () => onApply(preset),
    [onApply, preset]
  )
  const virtualCanvas = React.useMemo<CanvasState>(() => {
    const presetScale = resolvePresentPresetScale(preset, canvas.frame)
    return {
      ...canvas,
      tilt: preset.tilt,
      scale: presetScale,
      screenshotSlots: canvas.screenshotSlots.map((slot) => ({
        ...slot,
        tilt: preset.tilt,
        scale: resolvePresentPresetScale(preset, slot.frame),
      })),
    }
  }, [canvas, preset])
  return (
    <PresetCardShell
      active={active}
      ariaLabel={preset.name}
      onApply={handleApply}
      aspectStyle={aspectStyle}
      intrinsicSize="auto 220px"
      name={preset.name}
    >
      <CanvasPresetPreview
        aspect={aspect}
        virtualCanvas={virtualCanvas}
        previewId={`_preset_preview_single_${preset.id}`}
      />
    </PresetCardShell>
  )
})

const LayoutPresetCard = React.memo(function LayoutPresetCard({
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
    const geometry = resolveLayoutPresetGeometry(preset, canvas.frame)
    const aw = aspect.w || 16
    const ah = aspect.h || 10
    const canvasAspect = aw / ah
    // Compute natural row positions so relative presets offset correctly in preview
    const naturalLayout = computeRowLayout(
      [
        { id: "__main__", frame: canvas.frame },
        ...geometry.slots.map((_, i) => ({
          id: `_layout_preview_${i}`,
          frame: canvas.screenshotSlots[i]?.frame ?? canvas.frame,
        })),
      ],
      canvasAspect
    )
    const virtualSlots: ScreenshotSlot[] = geometry.slots.map((cfg, i) => {
      const naturalSlotX = naturalLayout[i + 1]?.xPct ?? 75
      const xPct = geometry.relativeSlotPositions
        ? naturalSlotX + cfg.xPct
        : cfg.xPct
      const yPct = geometry.relativeSlotPositions ? 50 + cfg.yPct : cfg.yPct
      return {
      id: `_layout_preview_${i}`,
      src: canvas.screenshotSlots[i]?.src ?? null,
      xPct,
      yPct,
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
    }})
    const PRESET_DESIGN_HEIGHT = BASE_CANVAS_WIDTH * (10 / 16)
    const offsetPx = geometry.mainOffset
      ? {
          x: (geometry.mainOffset.xPct / 100) * BASE_CANVAS_WIDTH,
          y: (geometry.mainOffset.yPct / 100) * PRESET_DESIGN_HEIGHT,
        }
      : { x: 0, y: 0 }
    return {
      ...canvas,
      tilt: geometry.canvasTilt,
      scale: geometry.canvasScale,
      screenshotSlots: virtualSlots,
      screenshotPosition: "center" as const,
      screenshotOffset: offsetPx,
    }
  }, [aspect, canvas, preset])

  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const aspectStyle: React.CSSProperties = {
    aspectRatio: `${aw} / ${ah}`,
  }
  const handleApply = React.useCallback(
    () => onApply(preset),
    [onApply, preset]
  )

  return (
    <PresetCardShell
      active={active}
      ariaLabel={preset.name}
      onApply={handleApply}
      aspectStyle={aspectStyle}
      intrinsicSize="auto 220px"
      name={preset.name}
    >
      <CanvasPresetPreview
        aspect={aspect}
        virtualCanvas={virtualCanvas}
        previewId={`_preset_preview_layout_${preset.id}`}
      />
    </PresetCardShell>
  )
})

const CanvasPresetPreview = React.memo(function CanvasPresetPreview({
  aspect,
  virtualCanvas,
  previewId,
}: {
  aspect: AspectState
  virtualCanvas: CanvasState
  previewId: string
}) {
  const previewRef = React.useRef<HTMLDivElement>(null)
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const stageWidth = BASE_CANVAS_WIDTH
  const stageHeight = (BASE_CANVAS_WIDTH * ah) / aw
  const previewScale = useContainScale(previewRef, stageWidth, stageHeight)
  return (
    <div ref={previewRef} className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-1/2 left-1/2 origin-center"
        style={{
          transform: `translate(-50%, -50%) scale(${previewScale})`,
        }}
      >
        <CanvasView
          canvasId={previewId}
          isActive={false}
          widthPx={stageWidth}
          heightPx={stageHeight}
          effectiveScale={previewScale}
          onActivate={() => undefined}
          previewMode
          canvasOverride={virtualCanvas}
        />
      </div>
    </div>
  )
})
