"use client"

import * as React from "react"
import { animate, AnimatePresence, motion } from "motion/react"

import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import { env } from "@/lib/env"
import { resolveMainOffsetPx } from "@/lib/editor/preset-geometry"
import {
  planLayoutPreset,
  planSinglePreset,
} from "@/lib/editor/preset-application"
import {
  LAYOUT_PRESETS,
  PRESENT_PRESETS,
  layoutPresetDeviceClassForFrame,
  type LayoutPreset,
  type PresentPreset,
} from "@/lib/editor/present-presets"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  RiArrowRightSLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLayoutGridLine,
} from "@remixicon/react"
import { toast } from "sonner"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  type AspectState,
  type CanvasState,
  type CustomPresetGeometry,
  type CustomPresetSummary,
  type ScreenshotSlot,
  type Tilt,
} from "@/lib/editor/store"
import { useSession } from "@/lib/auth-client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PresetMotionKind = "canvas" | "slot"

const PRESET_MOTION_MS = 560
const ENABLE_DEBUG_PRESETS = env.NEXT_PUBLIC_ENABLE_DEBUG_PRESETS

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
    zIndex: slot.zIndex,
  }))
  const presetPatch = {
    canvasTilt: {
      rx: roundLayoutNumber(canvas.tilt.rx),
      ry: roundLayoutNumber(canvas.tilt.ry),
      rz: roundLayoutNumber(canvas.tilt.rz),
    },
    canvasScale: roundLayoutNumber(canvas.scale),
    slots: slots.map(({ xPct, yPct, rotation, tilt, scale, zIndex }) => ({
      xPct,
      yPct,
      rotation,
      tilt,
      scale,
      zIndex,
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

type PresetTab = "single" | "multi" | "triple" | "custom"

type CanvasPresetUi = {
  tab: PresetTab
  activeLayoutPresetId: string | null
  activeSinglePresetId: string | null
  activeCustomPresetId: string | null
}

function emptyCanvasPresetUi(tab: PresetTab): CanvasPresetUi {
  return {
    tab,
    activeLayoutPresetId: null,
    activeSinglePresetId: null,
    activeCustomPresetId: null,
  }
}

const TAB_LABELS: Record<PresetTab, string> = {
  single: "Single",
  multi: "Multi",
  triple: "Triple",
  custom: "Custom",
}

function TabIcon({ t, active }: { t: PresetTab; active: boolean }) {
  const fill = active ? "text-primary/40" : "text-foreground/20"
  const stroke = active ? "text-primary/70" : "text-foreground/30"
  const fillSm = active ? "text-primary/30" : "text-foreground/15"
  const strokeSm = active ? "text-primary/60" : "text-foreground/25"

  if (t === "single") {
    return (
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
          className={fill}
        />
        <rect
          x="8"
          y="4"
          width="28"
          height="22"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
      </svg>
    )
  }
  if (t === "multi") {
    return (
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
          className={fill}
        />
        <rect
          x="2"
          y="6"
          width="20"
          height="18"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="24"
          y="9"
          width="18"
          height="15"
          rx="2"
          fill="currentColor"
          className={fillSm}
        />
        <rect
          x="24"
          y="9"
          width="18"
          height="15"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={strokeSm}
        />
      </svg>
    )
  }
  if (t === "triple") {
    return (
      <svg
        width="44"
        height="30"
        viewBox="0 0 44 30"
        fill="none"
        className="shrink-0"
      >
        <rect
          x="1"
          y="8"
          width="13"
          height="14"
          rx="2"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="1"
          y="8"
          width="13"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="16"
          y="6"
          width="12"
          height="18"
          rx="2"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="16"
          y="6"
          width="12"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="30"
          y="8"
          width="13"
          height="14"
          rx="2"
          fill="currentColor"
          className={fillSm}
        />
        <rect
          x="30"
          y="8"
          width="13"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={strokeSm}
        />
      </svg>
    )
  }
  // custom
  return (
    <svg
      width="44"
      height="30"
      viewBox="0 0 44 30"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M22 4 L26.6 13.5 L37 14.6 L29.5 21.6 L31.5 32 L22 26.8 L12.5 32 L14.5 21.6 L7 14.6 L17.4 13.5 Z"
        fill="currentColor"
        className={fill}
      />
      <path
        d="M22 4 L26.6 13.5 L37 14.6 L29.5 21.6 L31.5 32 L22 26.8 L12.5 32 L14.5 21.6 L7 14.6 L17.4 13.5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className={stroke}
      />
    </svg>
  )
}

function isTabDisabled(t: PresetTab, slotCount: number): boolean {
  if (t === "multi") return slotCount > 2
  if (t === "triple") return slotCount > 2
  return false
}

const PRESET_TABS: PresetTab[] = ["single", "multi", "triple", "custom"]

function TabTriggerRow({
  tab,
  slotCount,
  onTabChange,
}: {
  tab: PresetTab
  slotCount: number
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
            {TAB_LABELS[tab]}
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
        className="w-[220px] overflow-visible border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-[220px] rounded-lg bg-popover p-1.5 shadow-md ring-1 ring-foreground/10"
            >
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_TABS.map((t) => {
                    const disabled = isTabDisabled(t, slotCount)
                    const disabledReason =
                      t === "multi"
                        ? "Multi supports up to 2 screenshot boxes. Delete slots to switch."
                        : "Triple supports up to 3 screenshot boxes. Delete a slot to switch."
                    return (
                      <Tooltip key={t} open={disabled ? undefined : false}>
                        <TooltipTrigger asChild>
                          <button
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return
                              setOpen(false)
                              onTabChange(t)
                            }}
                            className={cn(
                              "flex flex-1 flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors",
                              tab === t
                                ? "border-primary bg-primary/10"
                                : disabled
                                  ? "cursor-not-allowed border-border/30 bg-secondary/15 opacity-40"
                                  : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
                            )}
                          >
                            <TabIcon t={t} active={tab === t} />
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                tab === t
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              )}
                            >
                              {TAB_LABELS[t]}
                            </span>
                          </button>
                        </TooltipTrigger>
                        {disabled && (
                          <TooltipContent side="bottom" sideOffset={6}>
                            {disabledReason}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}

export function PresentPresetsSection() {
  const canvas = useActiveCanvasField((c) => c)
  const canvasRef = React.useRef(canvas)
  canvasRef.current = canvas
  const activeCanvasId = useActiveCanvasId()
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspect = useActiveCanvasField((c) => c.aspect)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const aspect = bulkEditMode ? (canvasAspect ?? globalAspect) : globalAspect
  const aspectRef = React.useRef(aspect)
  aspectRef.current = aspect
  const setTiltAndScale = useEditorStore((s) => s.setTiltAndScale)
  const setScreenshotPosition = useEditorStore((s) => s.setScreenshotPosition)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const addScreenshotSlot = useEditorStore((s) => s.addScreenshotSlot)
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
  const customPresets = useEditorStore((s) => s.customPresets)
  const customPresetsLoaded = useEditorStore((s) => s.customPresetsLoaded)
  const setCustomPresets = useEditorStore((s) => s.setCustomPresets)
  const removeCustomPreset = useEditorStore((s) => s.removeCustomPreset)
  const activeCustomPresetId = useEditorStore((s) => s.activeCustomPresetId)
  const setActiveCustomPresetId = useEditorStore(
    (s) => s.setActiveCustomPresetId
  )
  const deleteScreenshotSlot = useEditorStore((s) => s.deleteScreenshotSlot)
  const [downgradeDialogOpen, setDowngradeDialogOpen] = React.useState(false)
  const [pendingTab, setPendingTab] = React.useState<PresetTab | null>(null)
  const [pendingLayoutPreset, setPendingLayoutPreset] =
    React.useState<LayoutPreset | null>(null)
  const [bulkPresetUiByCanvasId, setBulkPresetUiByCanvasId] = React.useState<
    Record<string, CanvasPresetUi>
  >({})
  const { data: session, isPending: isAuthPending } = useSession()
  const userId = session?.user?.id ?? null
  const [customPresetsLoading, setCustomPresetsLoading] =
    React.useState(false)

  const rememberBulkPresetUi = React.useCallback(
    (patch: Partial<CanvasPresetUi> & { tab: PresetTab }) => {
      if (!bulkEditMode || !activeCanvasId) return
      setBulkPresetUiByCanvasId((prev) => {
        const current = prev[activeCanvasId] ?? emptyCanvasPresetUi(patch.tab)
        return {
          ...prev,
          [activeCanvasId]: {
            ...current,
            ...patch,
          },
        }
      })
    },
    [activeCanvasId, bulkEditMode]
  )

  // Deferred canvas for preview cards — keeps the main interaction responsive
  // while preview thumbnails update in a lower-priority render pass.
  const deferredCanvas = React.useDeferredValue(canvas)
  const deferredAspect = React.useDeferredValue(aspect)

  const bulkPresetUi =
    bulkEditMode && activeCanvasId
      ? bulkPresetUiByCanvasId[activeCanvasId]
      : null
  const displayTab = bulkEditMode ? (bulkPresetUi?.tab ?? tab) : tab
  const displayActiveLayoutPresetId = bulkEditMode
    ? (bulkPresetUi?.activeLayoutPresetId ?? null)
    : activeLayoutPresetId
  const displayActiveSinglePresetId = bulkEditMode
    ? (bulkPresetUi?.activeSinglePresetId ?? null)
    : activeSinglePresetId
  const displayActiveCustomPresetId = bulkEditMode
    ? (bulkPresetUi?.activeCustomPresetId ?? null)
    : activeCustomPresetId

  const handleTabChange = React.useCallback(
    (nextTab: PresetTab) => {
      setTab(nextTab)
      rememberBulkPresetUi(emptyCanvasPresetUi(nextTab))
    },
    [rememberBulkPresetUi, setTab]
  )

  React.useEffect(() => {
    if (!userId) {
      setCustomPresets([])
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setCustomPresetsLoading(true)
    })
    fetch("/api/presets", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null
        const body: { presets: CustomPresetSummary[] } = await res.json()
        return body
      })
      .then((data) => {
        if (cancelled || !data) return
        setCustomPresets(data.presets)
      })
      .catch((err) => {
        console.warn("Could not load custom presets", err)
      })
      .finally(() => {
        if (!cancelled) setCustomPresetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, setCustomPresets])

  const handleDeleteCustomPreset = React.useCallback(
    async (id: string) => {
      const previous = customPresets
      removeCustomPreset(id)
      try {
        const res = await fetch(`/api/presets/${id}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok) {
          throw new Error("Delete failed")
        }
        toast.success("Preset removed")
      } catch (err) {
        console.error(err)
        setCustomPresets(previous)
        toast.error("Could not remove preset")
      }
    },
    [customPresets, removeCustomPreset, setCustomPresets]
  )
  const copyCurrentLayout = React.useCallback(async () => {
    const capture = buildLayoutPresetCapture({
      canvas: canvasRef.current,
      aspect: aspectRef.current,
      activeLayoutPresetId,
    })
    try {
      await navigator.clipboard.writeText(JSON.stringify(capture, null, 2))
      toast.success("Preset coordinates copied")
    } catch (error) {
      console.error(error)
      toast.error("Could not copy preset coordinates")
    }
  }, [activeLayoutPresetId, canvasRef, aspectRef])

  const applyPreset = React.useCallback(
    (preset: PresentPreset) => {
      const canvas = canvasRef.current
      const aspect = aspectRef.current
      const plan = planSinglePreset(preset, canvas, aspect)
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
        fromTilt: canvas.tilt,
        fromScale: canvas.scale,
        toTilt: plan.canvasTilt,
        toScale: plan.canvasScale,
      })
      setScreenshotPosition(plan.screenshotPosition)
      setTiltAndScale(plan.canvasTilt, plan.canvasScale)
      canvas.screenshotSlots.forEach((slot, i) => {
        const patch = plan.slots[i]
        if (!patch) return
        updateScreenshotSlot(slot.id, {
          xPct: patch.xPct,
          yPct: patch.yPct,
          widthPct: patch.widthPct ?? slot.widthPct,
          rotation: patch.rotation,
          tilt: patch.tilt,
          scale: patch.scale,
        })
      })
      setActiveSinglePresetId(preset.id)
      setActiveCustomPresetId(null)
      rememberBulkPresetUi({
        tab: "single",
        activeLayoutPresetId: null,
        activeSinglePresetId: preset.id,
        activeCustomPresetId: null,
      })
    },
    [
      activeCanvasId,
      canvasRef,
      aspectRef,
      rememberBulkPresetUi,
      setActiveCustomPresetId,
      setActiveSinglePresetId,
      setScreenshotPosition,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  const setScreenshotOffset = useEditorStore((s) => s.setScreenshotOffset)

  const applyLayoutPreset = React.useCallback(
    (preset: LayoutPreset) => {
      const canvas = canvasRef.current
      const aspect = aspectRef.current
      if (canvas.screenshotSlots.length > preset.slots.length) {
        setPendingLayoutPreset(preset)
        setDowngradeDialogOpen(true)
        return
      }
      const plan = planLayoutPreset(preset, canvas, aspect)
      setScreenshotPosition(plan.screenshotPosition)
      const currentSlotIds = canvas.screenshotSlots.map((s) => s.id)
      const newSlotIds: string[] = []
      for (let i = currentSlotIds.length; i < plan.slots.length; i++) {
        const id = addScreenshotSlot()
        if (id) newSlotIds.push(id)
      }
      const allSlotIds = [...currentSlotIds, ...newSlotIds]
      plan.slots.forEach((patch, i) => {
        const slotId = allSlotIds[i]
        if (!slotId) return
        updateScreenshotSlot(slotId, {
          xPct: patch.xPct,
          yPct: patch.yPct,
          rotation: patch.rotation,
          tilt: patch.tilt,
          scale: patch.scale,
          ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : {}),
        })
      })
      setTiltAndScale(plan.canvasTilt, plan.canvasScale)
      setScreenshotOffset(plan.screenshotOffset)
      setActiveLayoutPresetId(preset.id)
      setActiveCustomPresetId(null)
      rememberBulkPresetUi({
        tab: preset.slots.length === 2 ? "triple" : "multi",
        activeLayoutPresetId: preset.id,
        activeSinglePresetId: null,
        activeCustomPresetId: null,
      })
    },
    [
      addScreenshotSlot,
      canvasRef,
      aspectRef,
      rememberBulkPresetUi,
      setActiveCustomPresetId,
      setActiveLayoutPresetId,
      setScreenshotOffset,
      setScreenshotPosition,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  const applyPresetSnapshot = useEditorStore((s) => s.applyPresetSnapshot)

  const applyCustomPreset = React.useCallback(
    (preset: CustomPresetSummary) => {
      const geometry = preset.geometry
      // Geometry includes a snapshot of every styling field on the canvas
      // (background, backdrop, border, shadow, overlay, portrait, padding,
      // radius, frame, text/asset/annotation layers, etc.) — not just the
      // tilt and scale. `applyPresetSnapshot` commits all of those in a
      // single history entry while preserving the live screenshot pixels.
      applyPresetSnapshot(geometry)
      setActiveCustomPresetId(preset.id)
      setActiveLayoutPresetId(null)
      setActiveSinglePresetId(null)
      rememberBulkPresetUi({
        tab: "custom",
        activeLayoutPresetId: null,
        activeSinglePresetId: null,
        activeCustomPresetId: preset.id,
      })
    },
    [
      applyPresetSnapshot,
      rememberBulkPresetUi,
      setActiveCustomPresetId,
      setActiveLayoutPresetId,
      setActiveSinglePresetId,
    ]
  )

  const handleDowngradeConfirm = React.useCallback(() => {
    const canvas = canvasRef.current
    const aspect = aspectRef.current
    const lastSlot = canvas.screenshotSlots[canvas.screenshotSlots.length - 1]
    if (lastSlot) deleteScreenshotSlot(lastSlot.id)
    if (pendingLayoutPreset) {
      const plan = planLayoutPreset(pendingLayoutPreset, canvas, aspect)
      setScreenshotPosition(plan.screenshotPosition)
      const currentSlotIds = canvas.screenshotSlots
        .filter((s) => s.id !== lastSlot?.id)
        .map((s) => s.id)
      plan.slots.forEach((patch, i) => {
        const slotId = currentSlotIds[i]
        if (!slotId) return
        updateScreenshotSlot(slotId, {
          xPct: patch.xPct,
          yPct: patch.yPct,
          rotation: patch.rotation,
          tilt: patch.tilt,
          scale: patch.scale,
          ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : {}),
        })
      })
      setTiltAndScale(plan.canvasTilt, plan.canvasScale)
      setScreenshotOffset(plan.screenshotOffset)
      setActiveLayoutPresetId(pendingLayoutPreset.id)
      setActiveCustomPresetId(null)
      rememberBulkPresetUi({
        tab: pendingLayoutPreset.slots.length === 2 ? "triple" : "multi",
        activeLayoutPresetId: pendingLayoutPreset.id,
        activeSinglePresetId: null,
        activeCustomPresetId: null,
      })
      setPendingLayoutPreset(null)
    } else if (pendingTab) {
      setTab(pendingTab)
      rememberBulkPresetUi(emptyCanvasPresetUi(pendingTab))
      setPendingTab(null)
    }
    setDowngradeDialogOpen(false)
  }, [
    aspectRef,
    canvasRef,
    deleteScreenshotSlot,
    rememberBulkPresetUi,
    pendingLayoutPreset,
    pendingTab,
    setActiveCustomPresetId,
    setActiveLayoutPresetId,
    setScreenshotOffset,
    setScreenshotPosition,
    setTab,
    setTiltAndScale,
    updateScreenshotSlot,
  ])

  React.useEffect(() => {
    return () => presetMotionCleanupRef.current?.()
  }, [])

  return (
    <div className="space-y-3">
      <AlertDialog
        open={downgradeDialogOpen}
        onOpenChange={setDowngradeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This preset supports fewer screenshot boxes than you currently
              have. Applying it will delete the last screenshot slot. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingTab(null)
                setPendingLayoutPreset(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDowngradeConfirm}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Delete &amp; Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="sticky top-0 z-10 bg-[color:var(--editor-panel-bg,var(--color-sidebar))] pb-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-foreground">Presets</p>
          {ENABLE_DEBUG_PRESETS && (
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
          )}
        </div>
        <TabTriggerRow
          tab={displayTab}
          slotCount={canvas.screenshotSlots.length}
          onTabChange={handleTabChange}
        />
      </div>

      {displayTab === "single" && (
        <div className="space-y-2">
          {PRESENT_PRESETS.map((preset) => {
            const active = displayActiveSinglePresetId === preset.id

            return (
              <SinglePresetCard
                key={preset.id}
                preset={preset}
                canvas={deferredCanvas}
                aspect={deferredAspect}
                active={active}
                onApply={applyPreset}
              />
            )
          })}
        </div>
      )}

      {(displayTab === "multi" || displayTab === "triple") && (
        <div className="space-y-2">
          {LAYOUT_PRESETS.filter((p) =>
            displayTab === "triple"
              ? p.slots.length === 2
              : p.slots.length === 1
          ).map((preset) => {
            const active = displayActiveLayoutPresetId === preset.id
            return (
              <LayoutPresetCard
                key={preset.id}
                preset={preset}
                canvas={deferredCanvas}
                aspect={deferredAspect}
                active={active}
                onApply={applyLayoutPreset}
              />
            )
          })}
        </div>
      )}

      {displayTab === "custom" && (
        <CustomPresetList
          presets={customPresets}
          loading={
            isAuthPending ||
            customPresetsLoading ||
            (Boolean(userId) && !customPresetsLoaded)
          }
          loggedIn={Boolean(userId)}
          activeCustomPresetId={displayActiveCustomPresetId}
          canvas={deferredCanvas}
          aspect={deferredAspect}
          onApply={applyCustomPreset}
          onDelete={handleDeleteCustomPreset}
        />
      )}
    </div>
  )
}

function CustomPresetList({
  presets,
  loading,
  loggedIn,
  activeCustomPresetId,
  canvas,
  aspect,
  onApply,
  onDelete,
}: {
  presets: CustomPresetSummary[]
  loading: boolean
  loggedIn: boolean
  activeCustomPresetId: string | null
  canvas: CanvasState
  aspect: AspectState
  onApply: (preset: CustomPresetSummary) => void
  onDelete: (id: string) => void | Promise<void>
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/70 bg-card/70 p-3"
          >
            <Skeleton className="aspect-[16/10] w-full rounded-md" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-2/3 rounded-md" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-secondary/20 p-4 text-center text-[12px] text-muted-foreground">
        Sign in to save and reuse your own layout presets.
      </div>
    )
  }

  if (presets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-secondary/20 p-4 text-center text-[12px] text-muted-foreground">
        No custom presets yet. Use{" "}
        <span className="font-medium text-foreground">
          Save → Save as preset
        </span>{" "}
        to capture the current layout.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {presets.map((preset) => (
        <CustomPresetCard
          key={preset.id}
          preset={preset}
          canvas={canvas}
          aspect={aspect}
          active={activeCustomPresetId === preset.id}
          onApply={onApply}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

const CustomPresetCard = React.memo(function CustomPresetCard({
  preset,
  canvas,
  aspect,
  active,
  onApply,
  onDelete,
}: {
  preset: CustomPresetSummary
  canvas: CanvasState
  aspect: AspectState
  active: boolean
  onApply: (preset: CustomPresetSummary) => void
  onDelete: (id: string) => void | Promise<void>
}) {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const aspectStyle: React.CSSProperties = { aspectRatio: `${aw} / ${ah}` }
  const handleApply = React.useCallback(
    () => onApply(preset),
    [onApply, preset]
  )

  const virtualCanvas = React.useMemo<CanvasState>(() => {
    const geometry: CustomPresetGeometry = preset.geometry
    const style = geometry.canvasStyle
    const virtualSlots: ScreenshotSlot[] = geometry.slots.map((cfg, i) => ({
      id: `_custom_preview_${preset.id}_${i}`,
      src: canvas.screenshotSlots[i]?.src ?? null,
      xPct: cfg.xPct,
      yPct: cfg.yPct,
      widthPct: cfg.widthPct ?? 60,
      heightPct: cfg.heightPct ?? 28,
      rotation: cfg.rotation,
      tilt: cfg.tilt,
      scale: cfg.scale,
      zIndex: cfg.zIndex ?? i + 1,
      filter: cfg.filter ?? "none",
      hidden: cfg.hidden,
      objectFit: cfg.objectFit,
      shadow: cfg.shadow,
    }))
    const offsetPx = resolveMainOffsetPx(geometry.mainOffset)
    return {
      ...canvas,
      // Layer the saved style on top of the live canvas so the preview shows
      // the saved background/backdrop/border/shadow/etc. The screenshot
      // pixels still come from the live canvas, since the preset doesn't
      // carry images.
      ...(style?.background ? { background: style.background } : {}),
      ...(style && typeof style.padding === "number"
        ? { padding: style.padding }
        : {}),
      ...(style && typeof style.borderRadius === "number"
        ? { borderRadius: style.borderRadius }
        : {}),
      ...(style && typeof style.canvasBorderRadius === "number"
        ? { canvasBorderRadius: style.canvasBorderRadius }
        : {}),
      ...(style?.border ? { border: style.border } : {}),
      ...(style?.backdrop ? { backdrop: style.backdrop } : {}),
      ...(style?.screenshotLayer
        ? { screenshotLayer: style.screenshotLayer }
        : {}),
      ...(style?.shadow ? { shadow: style.shadow } : {}),
      ...(style?.overlay ? { overlay: style.overlay } : {}),
      ...(style?.frame ? { frame: style.frame } : {}),
      ...(style?.portrait ? { portrait: style.portrait } : {}),
      ...(style?.enhance ? { enhance: style.enhance } : {}),
      ...(style?.objectFit ? { objectFit: style.objectFit } : {}),
      ...(Array.isArray(style?.texts) ? { texts: style.texts } : {}),
      ...(Array.isArray(style?.assets) ? { assets: style.assets } : {}),
      ...(Array.isArray(style?.annotations)
        ? { annotations: style.annotations }
        : {}),
      ...(Array.isArray(style?.annotationShapes)
        ? { annotationShapes: style.annotationShapes }
        : {}),
      tilt: geometry.canvasTilt,
      scale: geometry.canvasScale,
      screenshotSlots: virtualSlots,
      screenshotPosition: style?.screenshotPosition ?? "center",
      screenshotOffset: offsetPx,
    }
  }, [canvas, preset])

  const [deleteOpen, setDeleteOpen] = React.useState(false)

  return (
    <div className="group/preset relative">
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
          previewId={`_preset_preview_custom_${preset.id}`}
        />
      </PresetCardShell>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDeleteOpen(true)
          }}
          aria-label={`Delete ${preset.name}`}
          className="absolute top-3 right-3 z-[1] inline-flex size-6 items-center justify-center rounded-full border border-white/12 bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover/preset:opacity-100 hover:border-destructive/45 hover:text-destructive focus:opacity-100"
        >
          <RiDeleteBinLine className="size-3.5" />
        </button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{preset.name}&rdquo; will be permanently deleted. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDelete(preset.id)}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})

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
    const plan = planSinglePreset(preset, canvas, aspect)
    return {
      ...canvas,
      tilt: plan.canvasTilt,
      scale: plan.canvasScale,
      screenshotPosition: plan.screenshotPosition,
      screenshotOffset: plan.screenshotOffset,
      screenshotSlots: canvas.screenshotSlots.map((slot, i) => {
        const patch = plan.slots[i]
        if (!patch) return slot
        return {
          ...slot,
          xPct: patch.xPct,
          yPct: patch.yPct,
          widthPct: patch.widthPct ?? slot.widthPct,
          rotation: patch.rotation,
          tilt: patch.tilt,
          scale: patch.scale,
        }
      }),
    }
  }, [aspect, canvas, preset])
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
    const plan = planLayoutPreset(preset, canvas, aspect)
    const virtualSlots: ScreenshotSlot[] = plan.slots.map((patch, i) => ({
      id: `_layout_preview_${i}`,
      src: canvas.screenshotSlots[i]?.src ?? null,
      xPct: patch.xPct,
      yPct: patch.yPct,
      widthPct: 60,
      heightPct: 28,
      rotation: patch.rotation,
      tilt: patch.tilt,
      scale: patch.scale,
      zIndex: patch.zIndex ?? i + 1,
      filter: "none" as const,
    }))
    return {
      ...canvas,
      tilt: plan.canvasTilt,
      scale: plan.canvasScale,
      screenshotSlots: virtualSlots,
      screenshotPosition: plan.screenshotPosition,
      screenshotOffset: plan.screenshotOffset,
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

// Render the same intrinsic canvas as the editor, then scale it into the
// thumbnail. Container-query UI, text size, and annotations then match the
// live canvas instead of adapting to a smaller fake canvas.
const PRESET_PREVIEW_WIDTH = BASE_CANVAS_WIDTH

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
  const stageWidth = PRESET_PREVIEW_WIDTH
  const stageHeight = (PRESET_PREVIEW_WIDTH * ah) / aw
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
