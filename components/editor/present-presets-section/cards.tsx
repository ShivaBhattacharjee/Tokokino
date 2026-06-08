"use client"

import * as React from "react"
import { RiCheckLine, RiDeleteBinLine } from "@remixicon/react"

import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { remoteImagePreviewUrl } from "@/lib/editor/image-resize"
import {
  planLayoutPreset,
  planSinglePreset,
} from "@/lib/editor/preset-application"
import { resolveMainOffsetPx } from "@/lib/editor/preset-geometry"
import {
  LAYOUT_PRESETS,
  PRESENT_PRESETS,
  type LayoutPreset,
  type PresentPreset,
} from "@/lib/editor/present-presets"
import type {
  AspectState,
  Background,
  CanvasState,
  CustomPresetGeometry,
  CustomPresetSummary,
  ScreenshotSlot,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import type { PresetTab } from "./tabs"

const MOBILE_PRESET_CARD_WIDTH = 172
/** Shell padding + label row below the aspect-ratio preview. */
const PRESET_CARD_CHROME_HEIGHT = 36

function mobilePresetRowMinHeight(aspect: AspectState) {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  return Math.ceil(
    MOBILE_PRESET_CARD_WIDTH * (ah / aw) + PRESET_CARD_CHROME_HEIGHT
  )
}

export function PresetCardsBody({
  displayTab,
  horizontal,
  activeSinglePresetId,
  activeLayoutPresetId,
  activeCustomPresetId,
  customPresets,
  customPresetsLoading,
  customPresetsLoaded,
  isAuthPending,
  userId,
  canvas,
  aspect,
  onApplySingle,
  onApplyLayout,
  onApplyCustom,
  onDeleteCustom,
}: {
  displayTab: PresetTab
  horizontal: boolean
  activeSinglePresetId: string | null
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  customPresets: CustomPresetSummary[]
  customPresetsLoading: boolean
  customPresetsLoaded: boolean
  isAuthPending: boolean
  userId: string | null
  canvas: CanvasState
  aspect: AspectState
  onApplySingle: (preset: PresentPreset) => void
  onApplyLayout: (preset: LayoutPreset) => void
  onApplyCustom: (preset: CustomPresetSummary) => void
  onDeleteCustom: (id: string) => void | Promise<void>
}) {
  return (
    <>
      {displayTab === "single" && (
        <PresetCardRow horizontal={horizontal} aspect={aspect}>
          {PRESENT_PRESETS.map((preset) => (
            <PresetCardSlot key={preset.id} horizontal={horizontal}>
              <SinglePresetCard
                preset={preset}
                canvas={canvas}
                aspect={aspect}
                horizontal={horizontal}
                active={activeSinglePresetId === preset.id}
                onApply={onApplySingle}
              />
            </PresetCardSlot>
          ))}
        </PresetCardRow>
      )}

      {(displayTab === "multi" || displayTab === "triple") && (
        <PresetCardRow horizontal={horizontal} aspect={aspect}>
          {LAYOUT_PRESETS.filter((preset) =>
            displayTab === "triple"
              ? preset.slots.length === 2
              : preset.slots.length === 1
          ).map((preset) => (
            <PresetCardSlot key={preset.id} horizontal={horizontal}>
              <LayoutPresetCard
                preset={preset}
                canvas={canvas}
                aspect={aspect}
                horizontal={horizontal}
                active={activeLayoutPresetId === preset.id}
                onApply={onApplyLayout}
              />
            </PresetCardSlot>
          ))}
        </PresetCardRow>
      )}

      {displayTab === "custom" && (
        <CustomPresetList
          horizontal={horizontal}
          presets={customPresets}
          loading={
            isAuthPending ||
            customPresetsLoading ||
            (Boolean(userId) && !customPresetsLoaded)
          }
          loggedIn={Boolean(userId)}
          activeCustomPresetId={activeCustomPresetId}
          canvas={canvas}
          aspect={aspect}
          onApply={onApplyCustom}
          onDelete={onDeleteCustom}
        />
      )}
    </>
  )
}

/** Lays preset cards out in a horizontal x-scroll strip (mobile) or the
 * default responsive grid/column. */
function PresetCardRow({
  horizontal,
  aspect,
  children,
}: {
  horizontal: boolean
  aspect?: AspectState
  children: React.ReactNode
}) {
  if (horizontal) {
    return (
      <div
        className="flex [scrollbar-width:none] items-end gap-3 overflow-x-auto overflow-y-hidden px-4 pt-1 pb-2 [&::-webkit-scrollbar]:hidden"
        style={
          aspect ? { minHeight: mobilePresetRowMinHeight(aspect) } : undefined
        }
      >
        {children}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 md:block md:space-y-2">
      {children}
    </div>
  )
}

function PresetCardSlot({
  horizontal,
  children,
}: {
  horizontal: boolean
  children: React.ReactNode
}) {
  if (horizontal) return <div className="w-[172px] shrink-0">{children}</div>
  return <>{children}</>
}

function CustomPresetList({
  presets,
  loading,
  loggedIn,
  activeCustomPresetId,
  canvas,
  aspect,
  horizontal = false,
  onApply,
  onDelete,
}: {
  presets: CustomPresetSummary[]
  loading: boolean
  loggedIn: boolean
  activeCustomPresetId: string | null
  canvas: CanvasState
  aspect: AspectState
  horizontal?: boolean
  onApply: (preset: CustomPresetSummary) => void
  onDelete: (id: string) => void | Promise<void>
}) {
  if (loading) {
    const aw = aspect.w || 16
    const ah = aspect.h || 10
    const aspectStyle: React.CSSProperties = { aspectRatio: `${aw} / ${ah}` }
    return (
      <PresetCardRow horizontal={horizontal} aspect={aspect}>
        {Array.from({ length: 2 }).map((_, i) => (
          <PresetCardSlot key={i} horizontal={horizontal}>
            {/* Mirror PresetCardShell exactly so the loading state doesn't
                shift size/spacing when the real cards swap in. */}
            <div
              className={cn(
                "w-full overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.045] p-1.5",
                !horizontal && i === 1 && "md:hidden"
              )}
            >
              <Skeleton className="w-full rounded-[6px]" style={aspectStyle} />
              <div className="mt-1.5 flex items-center justify-between gap-1.5">
                <Skeleton className="h-3 w-2/3 rounded" />
                <Skeleton className="size-5 shrink-0 rounded-full" />
              </div>
            </div>
          </PresetCardSlot>
        ))}
      </PresetCardRow>
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
    <PresetCardRow horizontal={horizontal} aspect={aspect}>
      {presets.map((preset) => (
        <PresetCardSlot key={preset.id} horizontal={horizontal}>
          <CustomPresetCard
            preset={preset}
            canvas={canvas}
            aspect={aspect}
            horizontal={horizontal}
            active={activeCustomPresetId === preset.id}
            onApply={onApply}
            onDelete={onDelete}
          />
        </PresetCardSlot>
      ))}
    </PresetCardRow>
  )
}

function previewImageAt(canvas: CanvasState, index: number) {
  if (index === 0) return canvas.screenshot ?? null
  return canvas.screenshotSlots[index - 1]?.src ?? null
}

function previewSafeBackground(bg: Background): Background {
  if (bg.type !== "image") return bg
  if (bg.thumbUrl) return { ...bg, value: bg.thumbUrl }
  if (bg.sourceUrl) {
    const small = remoteImagePreviewUrl(bg.sourceUrl, {
      maxDimension: 400,
      jpegQuality: 0.7,
    })
    if (small) return { ...bg, value: small }
  }
  return bg
}

const CustomPresetCard = React.memo(function CustomPresetCard({
  preset,
  canvas,
  aspect,
  horizontal = false,
  active,
  onApply,
  onDelete,
}: {
  preset: CustomPresetSummary
  canvas: CanvasState
  aspect: AspectState
  horizontal?: boolean
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
      src: previewImageAt(canvas, i + 1),
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
    const previewBg = previewSafeBackground(
      style?.background ?? canvas.background
    )
    return {
      ...canvas,
      // Layer the saved style on top of the live canvas so the preview shows
      // the saved background/backdrop/border/shadow/etc. The screenshot
      // pixels still come from the live canvas, since the preset doesn't
      // carry images.
      background: previewBg,
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
  const disabledReason =
    canvas.tweet && preset.geometry.slots.length > 0
      ? "Social posts use one content slot."
      : undefined

  return (
    <div className="group/preset relative">
      <PresetCardShell
        active={active}
        ariaLabel={preset.name}
        onApply={handleApply}
        aspectStyle={aspectStyle}
        intrinsicSize="auto 220px"
        eager={horizontal}
        name={preset.name}
        disabledReason={disabledReason}
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
          className="absolute top-3 right-3 z-[1] inline-flex size-6 items-center justify-center rounded-full border border-white/12 bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover/preset:opacity-100 hover:border-destructive/45 hover:text-destructive focus:opacity-100 [@media(hover:none)]:opacity-100"
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
  eager = false,
  disabledReason,
  children,
}: {
  active: boolean
  ariaLabel: string
  onApply: () => void
  aspectStyle: React.CSSProperties
  intrinsicSize: string
  name: string
  eager?: boolean
  disabledReason?: string
  children: React.ReactNode
}) {
  const shellRef = React.useRef<HTMLDivElement>(null)
  const deferredVisible = useDeferredVisibility(shellRef)
  const visible = eager || deferredVisible
  const disabled = Boolean(disabledReason)

  const shell = (
    <div
      ref={shellRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onApply}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        onApply()
      }}
      style={
        eager
          ? undefined
          : {
              contentVisibility: "auto",
              containIntrinsicSize: intrinsicSize,
            }
      }
      className={cn(
        "group w-full overflow-hidden rounded-[8px] border bg-white/[0.045] p-1.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-white/10 opacity-45"
          : "cursor-pointer",
        active && !disabled
          ? "border-primary ring-1 ring-primary/40"
          : !disabled && "border-white/12 hover:border-primary/55"
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
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] leading-tight font-medium">{name}</p>
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

  if (!disabledReason) return shell

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{shell}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

const SinglePresetCard = React.memo(function SinglePresetCard({
  preset,
  canvas,
  aspect,
  horizontal = false,
  active,
  onApply,
}: {
  preset: PresentPreset
  canvas: CanvasState
  aspect: AspectState
  horizontal?: boolean
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
      background: previewSafeBackground(canvas.background),
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
      eager={horizontal}
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
  horizontal = false,
  active,
  onApply,
}: {
  preset: LayoutPreset
  canvas: CanvasState
  aspect: AspectState
  horizontal?: boolean
  active: boolean
  onApply: (preset: LayoutPreset) => void
}) {
  const virtualCanvas = React.useMemo<CanvasState>(() => {
    const plan = planLayoutPreset(preset, canvas, aspect)
    const virtualSlots: ScreenshotSlot[] = plan.slots.map((patch, i) => ({
      id: `_layout_preview_${i}`,
      src: previewImageAt(canvas, i + 1),
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
      background: previewSafeBackground(canvas.background),
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
  const disabledReason = canvas.tweet
    ? "Social posts use one content slot."
    : undefined

  return (
    <PresetCardShell
      active={active}
      ariaLabel={preset.name}
      onApply={handleApply}
      aspectStyle={aspectStyle}
      intrinsicSize="auto 220px"
      eager={horizontal}
      name={preset.name}
      disabledReason={disabledReason}
    >
      <CanvasPresetPreview
        aspect={aspect}
        virtualCanvas={virtualCanvas}
        previewId={`_preset_preview_layout_${preset.id}`}
      />
    </PresetCardShell>
  )
})

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
