"use client"

import * as React from "react"
import {
  RiArrowUpCircleLine,
  RiCheckLine,
  RiEqualizerLine,
  RiCloseLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import {
  AnimationExportAbortedError,
  exportAnimation,
  type AnimationCaptureMode,
  type AnimationExportFormat,
  type AnimationExportProgress,
} from "@/lib/editor/animation-export"
import {
  exportCanvas,
  getCanvasRenderedDims,
  getOutputDims,
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_LABELS,
  EXPORT_RESOLUTION_LABELS,
  type ExportFormat,
  type ExportResolution,
} from "@/lib/editor/export"
import { useEditorStore } from "@/lib/editor/store"
import type { CanvasState } from "@/lib/editor/store"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { cn } from "@/lib/utils"
import { SegmentedRow, SummaryRow, SwitchRow } from "./ui"

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg", "webp"]
const EXPORT_RESOLUTIONS: ExportResolution[] = ["hd", "4k", "8k"]
const EXPORT_BUTTON_MAX_LABEL = `Export ${EXPORT_RESOLUTION_LABELS["hd"]} • ${EXPORT_FORMAT_LABELS.webp}`

/** Animate-mode export — fully local (user device). Optional on-frame watermark. */
const ANIMATION_FORMATS: AnimationExportFormat[] = ["mp4", "webm", "gif"]
const ANIMATION_FORMAT_LABELS: Record<AnimationExportFormat, string> = {
  gif: "GIF",
  webm: "WebM",
  mp4: "MP4",
}
const ANIMATION_FORMAT_EXTENSION: Record<AnimationExportFormat, string> = {
  gif: ".gif",
  webm: ".webm",
  mp4: ".mp4",
}
type AnimationExportResolution = "hd" | "fullhd" | "4k"
const ANIMATION_RESOLUTIONS: AnimationExportResolution[] = [
  "hd",
  "fullhd",
  "4k",
]
const ANIMATION_RESOLUTION_LABELS: Record<AnimationExportResolution, string> = {
  hd: "HD",
  fullhd: "Full HD",
  "4k": "4K",
}
// Note: 4K animation export encodes hundreds of frames at 3840px — it is slow
// and produces large files, especially GIF. Offered as an opt-in choice.
const ANIMATION_RESOLUTION_WIDTHS: Record<AnimationExportResolution, number> = {
  hd: 1080,
  fullhd: 1920,
  "4k": 3840,
}
type AnimationExportFps = 20 | 24 | 25 | 30 | 50 | 60
// Video encoders (MP4/WebM) handle any rate; GIF delays are whole centiseconds,
// so only rates that divide 100 cleanly (20→5cs, 25→4cs, 50→2cs) play smoothly.
const VIDEO_FPS_OPTIONS: AnimationExportFps[] = [24, 30, 60]
const GIF_FPS_OPTIONS: AnimationExportFps[] = [20, 25, 50]
const ANIMATION_FPS_OPTIONS: AnimationExportFps[] = [
  ...VIDEO_FPS_OPTIONS,
  ...GIF_FPS_OPTIONS,
]
function fpsOptionsForFormat(
  format: AnimationExportFormat
): AnimationExportFps[] {
  return format === "gif" ? GIF_FPS_OPTIONS : VIDEO_FPS_OPTIONS
}
/** Snap a persisted fps to the nearest option valid for the current format. */
function snapFpsToOptions(
  fps: number,
  options: AnimationExportFps[]
): AnimationExportFps {
  return options.reduce((best, cur) =>
    Math.abs(cur - fps) < Math.abs(best - fps) ? cur : best
  )
}
const ANIMATION_CAPTURE_MODES: AnimationCaptureMode[] = [
  "auto",
  "fast",
  "legacy",
]
const ANIMATION_CAPTURE_MODE_LABELS: Record<AnimationCaptureMode, string> = {
  auto: "Auto",
  fast: "Fast",
  legacy: "Precise",
}
const ANIMATION_BUTTON_MAX_LABEL = `Export ${ANIMATION_RESOLUTION_LABELS.fullhd} • ${ANIMATION_FORMAT_LABELS.webm}`

const ANIMATION_EXPORT_PHASE_LABELS: Record<
  AnimationExportProgress["phase"] | "idle",
  string
> = {
  idle: "Starting export",
  preparing: "Preparing canvas",
  capturing: "Rendering frames",
  encoding: "Encoding video",
  finishing: "Finishing download",
}

/** Friendly ETA like "< 5 min", "~30s", "Almost done". */
function formatExportEta(etaMs: number | null | undefined): string | null {
  if (etaMs == null || !Number.isFinite(etaMs)) return null
  if (etaMs <= 0) return "Almost done"
  const sec = Math.ceil(etaMs / 1000)
  if (sec < 5) return "< 5s"
  if (sec < 60) return `~${sec}s`
  const min = Math.ceil(sec / 60)
  if (min === 1) return "~1 min"
  if (min < 5) return `~${min} min`
  return `< ${min} min`
}

/**
 * Export wait UI with frame counter. Updates are throttled in the parent so
 * React isn't re-rendered every frame (that froze the main thread).
 */
function AnimationExportProgressDialog({
  open,
  progress,
  formatLabel,
  onCancel,
}: {
  open: boolean
  progress: AnimationExportProgress | null
  formatLabel: string
  onCancel: () => void
}) {
  const current = progress?.current ?? 0
  const total = Math.max(1, progress?.total ?? 1)
  const progressRatio =
    progress == null ? 0 : Math.min(1, Math.max(0, current / total))
  const pct = Math.round(progressRatio * 100)
  const showFrames =
    progress != null &&
    (progress.phase === "capturing" || progress.phase === "encoding") &&
    progress.total > 1
  const etaLabel = formatExportEta(progress?.etaMs)
  const phaseLabel =
    ANIMATION_EXPORT_PHASE_LABELS[progress?.phase ?? "idle"] ??
    ANIMATION_EXPORT_PHASE_LABELS.idle
  const frameLabel = showFrames
    ? `${Math.min(current, total)} of ${total} frames`
    : progress
      ? `${pct}% complete`
      : "Waiting to start"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-border/70 bg-popover/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:max-w-[400px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onCancel()
        }}
      >
        <div className="flex flex-col gap-5 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-[15px] leading-none font-semibold tracking-tight">
                Exporting {formatLabel}
              </DialogTitle>
              <DialogDescription className="text-[12px] leading-5 text-muted-foreground">
                {phaseLabel}
              </DialogDescription>
            </div>
            <div
              className="shrink-0 rounded-md border border-primary/15 bg-primary/10 px-2.5 py-1 text-[12px] leading-none font-semibold text-primary tabular-nums"
              aria-hidden="true"
            >
              {pct}%
            </div>
          </div>

          <div className="w-full space-y-3">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-secondary/80 shadow-inner"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Exporting ${formatLabel}`}
              aria-valuetext={`${pct}% complete, ${phaseLabel.toLowerCase()}`}
            >
              <motion.div
                className="relative h-full w-full origin-left overflow-hidden rounded-full bg-primary will-change-transform"
                initial={false}
                animate={{ scaleX: progressRatio }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="absolute inset-y-0 right-0 w-10 bg-linear-to-r from-transparent to-white/35" />
              </motion.div>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-[12px] text-muted-foreground">
              <span className="min-w-0 truncate font-mono tabular-nums">
                {frameLabel}
              </span>
              <span className="font-mono text-foreground/70 tabular-nums">
                {etaLabel ? `ETA ${etaLabel}` : "Calculating ETA"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 w-full gap-2 border-border/70 bg-background/30 text-[13px] text-foreground/75 hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
            onClick={onCancel}
          >
            <RiCloseLine className="size-4" />
            Cancel export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CanvasPreviewTile({
  canvas,
  index,
  isSelected,
  stageW,
  stageH,
  onToggle,
}: {
  canvas: CanvasState
  index: number
  isSelected: boolean
  stageW: number
  stageH: number
  onToggle: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(0.1)

  React.useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setScale(Math.min(rect.width / stageW, rect.height / stageH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [stageW, stageH])

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group flex flex-col rounded-[10px] border-2 p-1.5 text-left transition-all",
        isSelected
          ? "border-primary shadow-lg shadow-primary/20"
          : "border-border/40 opacity-50 hover:border-border hover:opacity-75"
      )}
    >
      <div
        ref={containerRef}
        className="relative isolate w-full overflow-hidden rounded-[6px] **:pointer-events-none"
        style={{ aspectRatio: `${stageW} / ${stageH}` }}
      >
        <div
          className="absolute top-1/2 left-1/2 origin-center"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <CanvasView
            canvasId={`_bulk_export_preview_${canvas.id}`}
            isActive={false}
            widthPx={stageW}
            heightPx={stageH}
            effectiveScale={scale}
            onActivate={() => undefined}
            previewMode
            canvasOverride={canvas}
          />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-foreground/70">
          Canvas {index + 1}
        </span>
        <div
          className={cn(
            "flex size-4 items-center justify-center rounded-full transition-all",
            isSelected ? "bg-primary text-white" : "border border-border/60"
          )}
        >
          {isSelected ? <RiCheckLine className="size-2.5" /> : null}
        </div>
      </div>
    </button>
  )
}

function BulkExportDialog({
  open,
  onOpenChange,
  format,
  setFormat,
  resolution,
  setResolution,
  includeWatermark,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: ExportFormat
  setFormat: (f: ExportFormat) => void
  resolution: ExportResolution
  setResolution: (r: ExportResolution) => void
  includeWatermark: boolean
}) {
  // Subscribe to the canvases list here (only the bulk dialog needs it) instead
  // of in the parent ExportControls — otherwise the always-visible Export button
  // re-rendered on every canvas change, including animation-timeline edits.
  const canvases = useEditorStore(useShallow((s) => s.present.canvases))
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(canvases.map((c) => c.id))
  )
  const [isExporting, setIsExporting] = React.useState(false)
  const [progress, setProgress] = React.useState<{
    done: number
    total: number
  } | null>(null)

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set(canvases.map((c) => c.id)))
      setProgress(null)
    }
  }, [open, canvases])

  const allSelected = canvases.every((c) => selected.has(c.id))
  const noneSelected = selected.size === 0

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(canvases.map((c) => c.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExport = async () => {
    if (isExporting || noneSelected) return
    const toExport = canvases.filter((c) => selected.has(c.id))
    setIsExporting(true)
    setProgress({ done: 0, total: toExport.length })
    let succeeded = 0
    for (let i = 0; i < toExport.length; i++) {
      try {
        await exportCanvas(toExport[i].id, format, resolution, {
          watermark: includeWatermark,
        })
        succeeded++
      } catch (err) {
        console.error(err)
        toast.error(`Canvas ${i + 1} export failed`)
      }
      setProgress({ done: i + 1, total: toExport.length })
    }
    setIsExporting(false)
    if (succeeded > 0) {
      toast.success(
        succeeded === 1 ? "1 canvas exported" : `${succeeded} canvases exported`
      )
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <div className="flex items-center justify-between border-b border-border/60 py-4 pr-12 pl-5">
          <div>
            <DialogTitle className="text-[15px]">Export canvases</DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px]">
              Click to toggle which canvases to include
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              allSelected
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div
          className="grid grid-cols-3 gap-3 overflow-y-auto p-4"
          style={{ maxHeight: "340px" }}
        >
          {canvases.map((canvas, idx) => {
            const isChecked = selected.has(canvas.id)
            const aspect = canvas.aspect ?? globalAspect
            const aw = aspect.w || 16
            const ah = aspect.h || 10
            const stageW = BASE_CANVAS_WIDTH
            const stageH = (BASE_CANVAS_WIDTH * ah) / aw
            return (
              <CanvasPreviewTile
                key={canvas.id}
                canvas={canvas}
                index={idx}
                isSelected={isChecked}
                stageW={stageW}
                stageH={stageH}
                onToggle={() => toggleOne(canvas.id)}
              />
            )
          })}
        </div>

        <div className="space-y-3 border-t border-border/60 px-5 py-4">
          <div className="space-y-2">
            <SegmentedRow
              options={EXPORT_FORMATS.map((f) => ({
                value: f,
                label: EXPORT_FORMAT_LABELS[f],
              }))}
              value={format}
              onChange={(v) => setFormat(v as ExportFormat)}
            />
            <SegmentedRow
              options={EXPORT_RESOLUTIONS.map((r) => ({
                value: r,
                label: EXPORT_RESOLUTION_LABELS[r],
              }))}
              value={resolution}
              onChange={(v) => setResolution(v as ExportResolution)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={() => void handleExport()}
              disabled={isExporting || noneSelected}
            >
              {isExporting && progress
                ? `Exporting ${progress.done}/${progress.total}…`
                : `Export ${selected.size > 0 ? selected.size : ""} canvas${selected.size !== 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function animationOutputDims(
  canvasId: string,
  resolution: AnimationExportResolution
): { width: number; height: number } | null {
  const rendered = getCanvasRenderedDims(canvasId)
  if (!rendered?.width || !rendered.height) return null
  const targetWidth = ANIMATION_RESOLUTION_WIDTHS[resolution]
  const scale = targetWidth / rendered.width
  return {
    width: Math.round(rendered.width * scale),
    height: Math.round(rendered.height * scale),
  }
}

export function ExportControls({
  includeWatermark,
  onIncludeWatermarkChange,
}: {
  includeWatermark: boolean
  onIncludeWatermarkChange: (include: boolean) => void
}) {
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
  const setTopBarPopoverOpen = useEditorStore((s) => s.setTopBarPopoverOpen)
  // Sticky export preferences — persisted so a chosen format/resolution/fps
  // survives reloads instead of snapping back to the default each session.
  const [format, setFormat] = usePersistentState<ExportFormat>(
    "tokokino:export:format",
    "png",
    (v): v is ExportFormat => EXPORT_FORMATS.includes(v as ExportFormat)
  )
  const [resolution, setResolution] = usePersistentState<ExportResolution>(
    "tokokino:export:resolution",
    "hd",
    (v): v is ExportResolution =>
      EXPORT_RESOLUTIONS.includes(v as ExportResolution)
  )
  const [animFormat, setAnimFormat] = usePersistentState<AnimationExportFormat>(
    "tokokino:export:animFormat",
    "mp4",
    (v): v is AnimationExportFormat =>
      ANIMATION_FORMATS.includes(v as AnimationExportFormat)
  )
  const [animResolution, setAnimResolution] =
    usePersistentState<AnimationExportResolution>(
      "tokokino:export:animResolution",
      "hd",
      (v): v is AnimationExportResolution =>
        ANIMATION_RESOLUTIONS.includes(v as AnimationExportResolution)
    )
  const [animFps, setAnimFps] = usePersistentState<AnimationExportFps>(
    "tokokino:export:animFps",
    30,
    (v): v is AnimationExportFps =>
      ANIMATION_FPS_OPTIONS.includes(v as AnimationExportFps)
  )
  const [animCapture, setAnimCapture] =
    usePersistentState<AnimationCaptureMode>(
      "tokokino:export:animCapture",
      "auto",
      (v): v is AnimationCaptureMode =>
        ANIMATION_CAPTURE_MODES.includes(v as AnimationCaptureMode)
    )
  // GIF only supports its centisecond-friendly rates; snap the persisted fps to
  // the options valid for the current format so a video rate (e.g. 30) picked
  // earlier resolves to the nearest GIF rate (25) when GIF is selected.
  // Memoized so the freshly-allocated options array has a stable identity — the
  // React Compiler needs that to preserve the `handleExport` memoization (which
  // depends on effectiveAnimFps).
  const animFpsOptions = React.useMemo(
    () => fpsOptionsForFormat(animFormat),
    [animFormat]
  )
  const effectiveAnimFps = React.useMemo(
    () => snapFpsToOptions(animFps, animFpsOptions),
    [animFps, animFpsOptions]
  )
  const [isExporting, setIsExporting] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  // Own hover state for the settings tooltip so it stays controlled for its
  // whole lifetime — forced shut while the popover is open (see below).
  const [settingsTooltipOpen, setSettingsTooltipOpen] = React.useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false)
  const [animProgress, setAnimProgress] =
    React.useState<AnimationExportProgress | null>(null)
  const animAbortRef = React.useRef<AbortController | null>(null)
  // Throttle UI updates so we still show Frame X/Y without re-rendering every
  // single capture. The fill itself eases between these snapshots.
  const lastUiPushRef = React.useRef(0)
  const lastUiSnapshotRef = React.useRef("")

  const cancelAnimExport = React.useCallback(() => {
    animAbortRef.current?.abort()
  }, [])

  const handleExport = React.useCallback(async () => {
    if (isExporting) return
    if (isAnimateMode) {
      const abort = new AbortController()
      animAbortRef.current = abort
      lastUiPushRef.current = 0
      lastUiSnapshotRef.current = ""
      setIsExporting(true)
      setAnimProgress({
        phase: "preparing",
        current: 0,
        total: 1,
        etaMs: null,
      })
      setOpen(false)
      try {
        await exportAnimation(activeCanvasId, {
          format: animFormat,
          fps: effectiveAnimFps,
          targetWidth: ANIMATION_RESOLUTION_WIDTHS[animResolution],
          watermark: includeWatermark,
          capture: animCapture,
          signal: abort.signal,
          onProgress: (p) => {
            const now = performance.now()
            const isPhaseChange =
              p.phase !== lastUiSnapshotRef.current.split("|")[0]
            const isDone = p.current >= p.total && p.total > 0
            // Always push phase changes + completion; throttle mid-flight.
            if (
              !isPhaseChange &&
              !isDone &&
              now - lastUiPushRef.current < 100
            ) {
              return
            }
            lastUiPushRef.current = now
            lastUiSnapshotRef.current = `${p.phase}|${p.current}|${p.total}`
            setAnimProgress(p)
          },
        })
        toast.success(
          `Saved as ${ANIMATION_FORMAT_LABELS[animFormat]}${ANIMATION_FORMAT_EXTENSION[animFormat]}`
        )
      } catch (err) {
        if (
          err instanceof AnimationExportAbortedError ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AnimationExportAbortedError")
        ) {
          toast.message("Export cancelled")
        } else {
          console.error(err)
          toast.error(
            err instanceof Error && err.message === "Nothing to export"
              ? "Nothing to export — add a keyframe first."
              : "Animation export failed. Please try again."
          )
        }
      } finally {
        animAbortRef.current = null
        setAnimProgress(null)
        setIsExporting(false)
      }
      return
    }
    if (bulkEditMode) {
      setBulkDialogOpen(true)
      return
    }
    setIsExporting(true)
    try {
      const filename = await exportCanvas(activeCanvasId, format, resolution, {
        watermark: includeWatermark,
      })
      toast.success(`Saved as ${filename}`)
    } catch (err) {
      console.error(err)
      toast.error("Export failed. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }, [
    activeCanvasId,
    animCapture,
    animFormat,
    effectiveAnimFps,
    animResolution,
    bulkEditMode,
    format,
    includeWatermark,
    isAnimateMode,
    resolution,
    isExporting,
  ])

  const dims = open
    ? isAnimateMode
      ? animationOutputDims(activeCanvasId, animResolution)
      : getOutputDims(activeCanvasId, resolution)
    : null
  const dimsLabel = dims ? `${dims.width} × ${dims.height}` : "—"

  const buttonLabel = isExporting
    ? "Exporting…"
    : isAnimateMode
      ? `Export ${ANIMATION_RESOLUTION_LABELS[animResolution]} • ${ANIMATION_FORMAT_LABELS[animFormat]}`
      : `Export ${EXPORT_RESOLUTION_LABELS[resolution]} • ${EXPORT_FORMAT_LABELS[format]}`

  return (
    <>
      <AnimationExportProgressDialog
        open={isExporting && isAnimateMode}
        progress={animProgress}
        formatLabel={ANIMATION_FORMAT_LABELS[animFormat]}
        onCancel={cancelAnimExport}
      />

      <div className="flex h-8 items-stretch overflow-hidden rounded-md bg-primary text-white shadow-sm transition-all hover:shadow-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 transition-colors hover:bg-white/10"
              disabled={isExporting}
              onClick={() => void handleExport()}
            >
              <RiArrowUpCircleLine className="size-4 shrink-0" />
              <span className="relative inline-grid text-[12px] font-medium tracking-tight [&>span]:col-start-1 [&>span]:row-start-1">
                <span
                  className="invisible pr-0.5 whitespace-nowrap"
                  aria-hidden
                >
                  {isAnimateMode
                    ? ANIMATION_BUTTON_MAX_LABEL
                    : EXPORT_BUTTON_MAX_LABEL}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isExporting ? "exporting" : buttonLabel}
                    className="whitespace-nowrap"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {buttonLabel}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isAnimateMode ? "Export animation" : "Export screenshot"}
          </TooltipContent>
        </Tooltip>

        <div className="w-px bg-white/20" />

        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            setTopBarPopoverOpen(o)
          }}
        >
          <Tooltip
            open={open ? false : settingsTooltipOpen}
            onOpenChange={setSettingsTooltipOpen}
          >
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center px-2.5 transition-colors hover:bg-white/10"
                >
                  <RiEqualizerLine className="size-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Export settings</TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-64 gap-3 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-md data-open:zoom-in-95 data-closed:zoom-out-95"
          >
            {isAnimateMode ? (
              <>
                <SegmentedRow
                  options={ANIMATION_FORMATS.map((f) => ({
                    value: f,
                    label: ANIMATION_FORMAT_LABELS[f],
                  }))}
                  value={animFormat}
                  onChange={(v) => setAnimFormat(v as AnimationExportFormat)}
                />
                <SegmentedRow
                  options={ANIMATION_RESOLUTIONS.map((r) => ({
                    value: r,
                    label: ANIMATION_RESOLUTION_LABELS[r],
                  }))}
                  value={animResolution}
                  onChange={(v) =>
                    setAnimResolution(v as AnimationExportResolution)
                  }
                />
                <SegmentedRow
                  options={animFpsOptions.map((fps) => ({
                    value: String(fps),
                    label: `${fps} fps`,
                  }))}
                  value={String(effectiveAnimFps)}
                  onChange={(v) => setAnimFps(Number(v) as AnimationExportFps)}
                />
                <div className="flex flex-col gap-1 px-1 pt-1">
                  <SummaryRow label="Resolution" value={dimsLabel} />
                  <div className="h-px bg-border/50" />
                  <SummaryRow
                    label="Frame rate"
                    value={`${effectiveAnimFps} fps`}
                  />
                  <div className="h-px bg-border/50" />
                  <SummaryRow
                    label="Format"
                    value={ANIMATION_FORMAT_EXTENSION[animFormat]}
                  />
                  <div className="h-px bg-border/50" />
                  <SwitchRow
                    label="Watermark"
                    checked={includeWatermark}
                    onCheckedChange={onIncludeWatermarkChange}
                  />
                </div>
                <div className="flex flex-col gap-1 px-1">
                  <span className="px-1 text-[11px] text-muted-foreground">
                    Capture engine
                  </span>
                  <SegmentedRow
                    options={ANIMATION_CAPTURE_MODES.map((m) => ({
                      value: m,
                      label: ANIMATION_CAPTURE_MODE_LABELS[m],
                    }))}
                    value={animCapture}
                    onChange={(v) => setAnimCapture(v as AnimationCaptureMode)}
                  />
                </div>
              </>
            ) : (
              <>
                <SegmentedRow
                  options={EXPORT_FORMATS.map((f) => ({
                    value: f,
                    label: EXPORT_FORMAT_LABELS[f],
                  }))}
                  value={format}
                  onChange={(v) => setFormat(v as ExportFormat)}
                />
                <SegmentedRow
                  options={EXPORT_RESOLUTIONS.map((r) => ({
                    value: r,
                    label: EXPORT_RESOLUTION_LABELS[r],
                  }))}
                  value={resolution}
                  onChange={(v) => setResolution(v as ExportResolution)}
                />
                <div className="flex flex-col gap-1 px-1 pt-1">
                  <SummaryRow label="Resolution" value={dimsLabel} />
                  <div className="h-px bg-border/50" />
                  <SummaryRow
                    label="Format"
                    value={EXPORT_FORMAT_EXTENSION[format]}
                  />
                  <div className="h-px bg-border/50" />
                  <SwitchRow
                    label="Watermark"
                    checked={includeWatermark}
                    onCheckedChange={onIncludeWatermarkChange}
                  />
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <BulkExportDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        format={format}
        setFormat={setFormat}
        resolution={resolution}
        setResolution={setResolution}
        includeWatermark={includeWatermark}
      />
    </>
  )
}
