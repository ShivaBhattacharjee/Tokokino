"use client"

import * as React from "react"

import { env } from "@/lib/env"
import {
  planLayoutPreset,
  planSinglePreset,
} from "@/lib/editor/preset-application"
import {
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
import { RiFileCopyLine } from "@remixicon/react"
import { toast } from "sonner"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  type CustomPresetSummary,
} from "@/lib/editor/store"
import { useSession } from "@/lib/auth-client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { PresetCardsBody } from "./present-presets-section/cards"
import { buildLayoutPresetCapture } from "./present-presets-section/debug-capture"
import { startPresetMotion } from "./present-presets-section/motion"
import {
  TabTriggerRow,
  emptyCanvasPresetUi,
  type CanvasPresetUi,
  type PresetTab,
} from "./present-presets-section/tabs"

const ENABLE_DEBUG_PRESETS = env.NEXT_PUBLIC_ENABLE_DEBUG_PRESETS

export function PresentPresetsSection({
  flat = false,
  horizontal = false,
  showPresetHeading = true,
}: {
  flat?: boolean
  horizontal?: boolean
  showPresetHeading?: boolean
}) {
  const canvas = useActiveCanvasField((c) => c)
  const canvasRef = React.useRef(canvas)
  React.useLayoutEffect(() => {
    canvasRef.current = canvas
  })
  const activeCanvasId = useActiveCanvasId()
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspect = useActiveCanvasField((c) => c.aspect)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const aspect = bulkEditMode ? (canvasAspect ?? globalAspect) : globalAspect
  const aspectRef = React.useRef(aspect)
  React.useLayoutEffect(() => {
    aspectRef.current = aspect
  })
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
  const [customPresetsLoading, setCustomPresetsLoading] = React.useState(false)

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
  const hasTweet = Boolean(canvas.tweet)

  const handleTabChange = React.useCallback(
    (nextTab: PresetTab) => {
      if (hasTweet && (nextTab === "multi" || nextTab === "triple")) {
        toast("Social posts use one content slot")
        return
      }
      setTab(nextTab)
      rememberBulkPresetUi(emptyCanvasPresetUi(nextTab))
    },
    [hasTweet, rememberBulkPresetUi, setTab]
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
      if (canvas.tweet) {
        toast("Social posts use one content slot")
        return
      }
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
      if (canvasRef.current.tweet && geometry.slots.length > 0) {
        toast("Social posts use one content slot")
        return
      }
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
    <div
      className={cn(
        flat ? "flex flex-col" : "flex min-h-0 flex-1 flex-col",
        flat && horizontal && "shrink-0"
      )}
    >
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
      <div className="shrink-0 px-4 pb-3">
        {(showPresetHeading || ENABLE_DEBUG_PRESETS) && (
          <div className="mb-2 flex items-center justify-between gap-2">
            {showPresetHeading ? (
              <p className="text-[13px] font-medium text-foreground">Presets</p>
            ) : (
              <span aria-hidden />
            )}
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
        )}
        <TabTriggerRow
          tab={displayTab}
          slotCount={canvas.screenshotSlots.length}
          hasTweet={hasTweet}
          onTabChange={handleTabChange}
        />
      </div>

      {(() => {
        const body = (
          <PresetCardsBody
            displayTab={displayTab}
            horizontal={horizontal}
            activeSinglePresetId={displayActiveSinglePresetId}
            activeLayoutPresetId={displayActiveLayoutPresetId}
            activeCustomPresetId={displayActiveCustomPresetId}
            customPresets={customPresets}
            customPresetsLoading={customPresetsLoading}
            customPresetsLoaded={customPresetsLoaded}
            isAuthPending={isAuthPending}
            userId={userId}
            canvas={deferredCanvas}
            aspect={deferredAspect}
            onApplySingle={applyPreset}
            onApplyLayout={applyLayoutPreset}
            onApplyCustom={applyCustomPreset}
            onDeleteCustom={handleDeleteCustomPreset}
          />
        )

        if (horizontal) return body
        return (
          <ScrollArea
            className={flat ? "pr-3 pl-4" : "min-h-0 flex-1 pr-3 pl-4"}
          >
            <div className="pr-1 pb-4">{body}</div>
          </ScrollArea>
        )
      })()}
    </div>
  )
}
