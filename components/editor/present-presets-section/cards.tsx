"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiBookmarkLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiMore2Fill,
  RiPencilLine,
} from "@remixicon/react"

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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ShimmerBox } from "@/components/ui/shimmer-image"
import { PRESET_NAME_MAX_LENGTH } from "@/lib/schemas/preset"
import { remoteImagePreviewUrl } from "@/lib/editor/image-resize"
import { LIVE_PREVIEW_ROOT_ATTR } from "@/lib/editor/live-preview-vars"
import { isVideoSrc } from "@/lib/editor/media-type"
import { isUnsplashImageUrl } from "@/lib/editor/unsplash"
import {
  planLayoutPreset,
  planSinglePresetSlotRow,
  type SinglePresetSlotRow,
} from "@/lib/editor/preset-application"
import { resolveMainOffsetPx } from "@/lib/editor/preset-geometry"
import { mergeCanvasStyle } from "@/lib/editor/preset-fields"
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

type SinglePresetSlotLayout = SinglePresetSlotRow & {
  slots: ScreenshotSlot[]
}

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
  customPresetsError = false,
  isAuthPending,
  userId,
  isAnimateMode = false,
  canvas,
  aspect,
  onApplySingle,
  onApplyLayout,
  onApplyCustom,
  onDeleteCustom,
  onRenameCustom,
  onRetryCustom,
}: {
  displayTab: PresetTab
  horizontal: boolean
  activeSinglePresetId: string | null
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  customPresets: CustomPresetSummary[]
  customPresetsLoading: boolean
  customPresetsLoaded: boolean
  /** Last load failed — show that instead of an empty account. */
  customPresetsError?: boolean
  isAuthPending: boolean
  userId: string | null
  /** When true, Custom tab is showing animate presets only. */
  isAnimateMode?: boolean
  canvas: CanvasState
  aspect: AspectState
  onApplySingle: (preset: PresentPreset) => void
  onApplyLayout: (preset: LayoutPreset) => void
  onApplyCustom: (preset: CustomPresetSummary) => void
  onDeleteCustom: (id: string) => void | Promise<void>
  onRenameCustom: (id: string, name: string) => void | Promise<void>
  onRetryCustom?: () => void
}) {
  // Every single preset shares this row math, so run it once for the rail.
  // `null` when there are no extra slots — the common case, and the one where
  // a single-preset preview needs no state override at all.
  const singleSlotLayout = React.useMemo<SinglePresetSlotLayout | null>(() => {
    if (canvas.screenshotSlots.length === 0) return null
    const row = planSinglePresetSlotRow(canvas, aspect)
    return { ...row, slots: canvas.screenshotSlots }
  }, [aspect, canvas])

  return (
    <>
      {displayTab === "single" && (
        <PresetCardRow horizontal={horizontal} aspect={aspect}>
          {PRESENT_PRESETS.map((preset) => (
            <PresetCardSlot key={preset.id} horizontal={horizontal}>
              <SinglePresetCard
                preset={preset}
                slotLayout={singleSlotLayout}
                sourceCanvasId={canvas.id}
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
          failed={customPresetsError}
          onRetry={onRetryCustom}
          loggedIn={Boolean(userId)}
          isAnimateMode={isAnimateMode}
          activeCustomPresetId={activeCustomPresetId}
          canvas={canvas}
          aspect={aspect}
          onApply={onApplyCustom}
          onDelete={onDeleteCustom}
          onRename={onRenameCustom}
        />
      )}
    </>
  )
}

function PresetEmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-secondary/40 px-4 py-5 text-center">
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/60">
        {icon}
      </span>
      <p className="text-[12px] font-medium text-foreground">{title}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
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
  failed = false,
  loggedIn,
  isAnimateMode = false,
  activeCustomPresetId,
  canvas,
  aspect,
  horizontal = false,
  onApply,
  onDelete,
  onRename,
  onRetry,
}: {
  presets: CustomPresetSummary[]
  loading: boolean
  failed?: boolean
  loggedIn: boolean
  isAnimateMode?: boolean
  activeCustomPresetId: string | null
  canvas: CanvasState
  aspect: AspectState
  horizontal?: boolean
  onApply: (preset: CustomPresetSummary) => void
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, name: string) => void | Promise<void>
  onRetry?: () => void
}) {
  if (loading) {
    const aw = aspect.w || 16
    const ah = aspect.h || 10
    const aspectStyle: React.CSSProperties = { aspectRatio: `${aw} / ${ah}` }
    return (
      <PresetCardRow horizontal={horizontal} aspect={aspect}>
        {Array.from({ length: horizontal ? 2 : 3 }).map((_, i) => (
          <PresetCardSlot key={i} horizontal={horizontal}>
            {/* Mirror PresetCardShell exactly so the loading state doesn't
                shift size/spacing when the real cards swap in. Desktop shows
                three placeholders so we don't flash a single card then jump. */}
            <div className="w-full overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.045] p-1.5">
              <ShimmerBox
                className="w-full rounded-[6px]"
                style={aspectStyle}
              />
              <div className="mt-1.5 flex items-center justify-between gap-1.5">
                <ShimmerBox className="h-3 w-2/3 rounded" />
                <ShimmerBox className="size-5 shrink-0 rounded-full" />
              </div>
            </div>
          </PresetCardSlot>
        ))}
      </PresetCardRow>
    )
  }

  if (!loggedIn) {
    return (
      <PresetEmptyState
        icon={<RiBookmarkLine className="size-4" />}
        title="Save your own presets"
        body="Sign in to keep the current layout and reuse it on any canvas."
        action={
          <Link
            href="/login"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
          >
            Sign in
          </Link>
        }
      />
    )
  }

  // Ranked above the empty state: "no presets yet" would be a claim about the
  // account that a failed request can't support.
  if (failed) {
    return (
      <PresetEmptyState
        icon={<RiErrorWarningLine className="size-4 text-destructive" />}
        title="Could not load your presets"
        body="Check your connection and try again."
        action={
          onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center rounded-md bg-secondary/70 px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              Try again
            </button>
          ) : null
        }
      />
    )
  }

  if (presets.length === 0) {
    return (
      <PresetEmptyState
        icon={<RiBookmarkLine className="size-4" />}
        title={
          isAnimateMode ? "No animate presets yet" : "No custom presets yet"
        }
        body={
          <>
            Use{" "}
            <span className="font-medium text-foreground">
              Save → Save as preset
            </span>{" "}
            {isAnimateMode
              ? "while Animate is on to capture the current timeline."
              : "to capture the current layout."}
          </>
        }
      />
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
            active={activeCustomPresetId === preset.id}
            onApply={onApply}
            onDelete={onDelete}
            onRename={onRename}
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
  // Keep Unsplash CDN hotlinks so photographer views still count in previews.
  const hotlinkCandidate = bg.sourceUrl ?? bg.value
  if (isUnsplashImageUrl(hotlinkCandidate)) {
    return {
      ...bg,
      value:
        bg.thumbUrl && isUnsplashImageUrl(bg.thumbUrl)
          ? bg.thumbUrl
          : hotlinkCandidate,
    }
  }
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
  active,
  onApply,
  onDelete,
  onRename,
}: {
  preset: CustomPresetSummary
  canvas: CanvasState
  aspect: AspectState
  active: boolean
  onApply: (preset: CustomPresetSummary) => void
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, name: string) => void | Promise<void>
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
      adjustments: cfg.adjustments,
      hidden: cfg.hidden,
      objectFit: cfg.objectFit,
      shadow: cfg.shadow,
    }))
    const offsetPx = resolveMainOffsetPx(geometry.mainOffset)
    // Layer the saved style over the live canvas so the preview shows the saved
    // background/backdrop/border/shadow/etc; screenshot pixels stay live (the
    // preset carries none). Geometry is set from the preset below.
    const styled = mergeCanvasStyle(canvas, style)
    return {
      ...styled,
      background: previewSafeBackground(styled.background),
      tilt: geometry.canvasTilt,
      scale: geometry.canvasScale,
      screenshotSlots: virtualSlots,
      screenshotPosition: style?.screenshotPosition ?? "center",
      screenshotOffset: offsetPx,
    }
  }, [canvas, preset])

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const disabledReason =
    canvas.tweet && preset.geometry.slots.length > 0
      ? "Social posts use one content slot."
      : canvas.screenshot &&
          isVideoSrc(canvas.screenshot) &&
          preset.geometry.slots.length > 0
        ? "Videos can only use a single slot."
        : undefined

  return (
    <div className="group/preset relative">
      <PresetCardShell
        active={active}
        ariaLabel={preset.name}
        onApply={handleApply}
        aspectStyle={aspectStyle}
        intrinsicSize="auto 220px"
        // Custom lists are short — mount every preview immediately so refresh
        // doesn't paint one card via IntersectionObserver then drip in the rest.
        eager
        name={preset.name}
        disabledReason={disabledReason}
      >
        <CanvasPresetPreview
          aspect={aspect}
          virtualCanvas={virtualCanvas}
          previewId={`_preset_preview_custom_${preset.id}`}
        />
      </PresetCardShell>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Preset options for ${preset.name}`}
            className="absolute top-3 right-3 z-[1] inline-flex size-6 items-center justify-center rounded-full border border-white/12 bg-background/80 text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 data-[state=open]:border-primary/45 data-[state=open]:text-foreground"
          >
            <RiMore2Fill className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onSelect={() => setRenameOpen(true)}
            className="cursor-pointer gap-2"
          >
            <RiPencilLine className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
            className="cursor-pointer gap-2"
          >
            <RiDeleteBinLine className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenamePresetDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={preset.name}
        onRename={(name) => onRename(preset.id, name)}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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

function RenamePresetDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (name: string) => void | Promise<void>
}) {
  const [name, setName] = React.useState(currentName)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(currentName)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [open, currentName])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== currentName

  const submit = React.useCallback(() => {
    if (!canSubmit) return
    void onRename(trimmed)
    onOpenChange(false)
  }, [canSubmit, onOpenChange, onRename, trimmed])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Rename preset</DialogTitle>
          <DialogDescription>Give this preset a new name.</DialogDescription>
        </DialogHeader>
        <Input
          ref={inputRef}
          aria-label="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          maxLength={PRESET_NAME_MAX_LENGTH}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
        />
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="lg" onClick={submit} disabled={!canSubmit}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        {visible ? (
          children
        ) : (
          <ShimmerBox className="absolute inset-0 size-full" />
        )}
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
  slotLayout,
  sourceCanvasId,
  aspect,
  horizontal = false,
  active,
  onApply,
}: {
  preset: PresentPreset
  /** Row-layout geometry for the extra slots, or null when there are none. */
  slotLayout: SinglePresetSlotLayout | null
  sourceCanvasId: string | null
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
  // A single preset differs from the live canvas by its tilt and — when extra
  // slots exist — their row placement. `planSinglePreset` takes scale,
  // position and offset straight off the canvas, and everything else (styling,
  // text, assets, annotations) is untouched. So the preview subscribes to the
  // real canvas and overrides only those two fields, instead of cloning a
  // whole `CanvasState` per card on every edit. `preset.tilt` is a module
  // constant, so with no extra slots this override never changes identity and
  // a padding or background edit re-renders nothing here.
  const override = React.useMemo<Partial<CanvasState>>(() => {
    if (!slotLayout) return { tilt: preset.tilt }
    return {
      tilt: preset.tilt,
      screenshotSlots: slotLayout.slots.map((slot, i) => {
        const placement = slotLayout.placements[i]
        if (!placement) return slot
        return {
          ...slot,
          xPct: placement.xPct,
          yPct: 50,
          widthPct: placement.widthPct ?? slot.widthPct,
          rotation: 0,
          tilt: preset.tilt,
          scale: slotLayout.scale,
        }
      }),
    }
  }, [preset.tilt, slotLayout])

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
        virtualCanvas={override}
        sourceCanvasId={sourceCanvasId}
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
    : canvas.screenshot && isVideoSrc(canvas.screenshot)
      ? "Videos can only use a single slot."
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
  sourceCanvasId = null,
  previewId,
}: {
  aspect: AspectState
  virtualCanvas: Partial<CanvasState> | null
  /** Canvas to read live state from; omitted when `virtualCanvas` is a full
   * standalone state (custom presets). */
  sourceCanvasId?: string | null
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
      {/* Tagging the stage as a live-preview root lets slider drags write vars
          like padding, shadow and zoom onto it, so the thumbnail tracks the
          drag instead of waiting for the commit. Tilt is deliberately not
          fanned out this way — each thumbnail pins the tilt of the preset it
          represents. */}
      <div
        className="absolute top-1/2 left-1/2 origin-center"
        style={{ transform: `translate(-50%, -50%) scale(${previewScale})` }}
        {...(sourceCanvasId
          ? { [LIVE_PREVIEW_ROOT_ATTR]: sourceCanvasId }
          : null)}
      >
        <CanvasView
          canvasId={previewId}
          isActive={false}
          widthPx={stageWidth}
          heightPx={stageHeight}
          effectiveScale={previewScale}
          onActivate={() => undefined}
          previewMode
          sourceCanvasId={sourceCanvasId}
          canvasOverride={virtualCanvas}
        />
      </div>
    </div>
  )
})
