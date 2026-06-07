"use client"

import * as React from "react"
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiEyeLine,
  RiFileAddLine,
  RiFileCopyLine,
  RiLayoutGridLine,
  RiRefreshLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { LoginForm } from "@/app/login/login-form"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSession } from "@/lib/auth-client"
import {
  captureCanvasForShare,
  captureCanvasThumbnail,
  copyCanvasAsPng,
  createImageThumbnailBlob,
} from "@/lib/editor/export"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { saveCurrentEditorDraft, useEditorStore } from "@/lib/editor/store"
import { tweetSettingsFromCard } from "@/lib/editor/tweet-settings"
import type {
  CurrentDraftInfo,
  CustomPresetGeometry,
  CustomPresetSummary,
} from "@/lib/editor/store"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import {
  DRAFT_SCHEMA_VERSION,
  type DraftPayload,
  unwrapDraftState,
} from "@/lib/schemas/draft"
import { randomDisplayName } from "@/lib/random-name"

import { ExportControls } from "./export-controls"
import { MobileOverflowMenu } from "./mobile-overflow-menu"
import { MobileShareDialog, ShareControls } from "./share-controls"
import { MobileSaveDialog, SaveControls } from "./save-controls"
import {
  DraftChoiceDialog,
  NameDialog,
  PresetChoiceDialog,
} from "./save-dialogs"
import { OpenControls } from "./open-controls"
import { OpenProjectDialog } from "./open-project-dialog"
import { IconAction, TopBarButton } from "./ui"
import {
  createShareSignature,
  waitForNextPaint,
  waitForShareSkeleton,
  type ProtectedTopBarAction,
  type ShareDialogState,
} from "./types"

export function TopBar() {
  const { data: session, isPending: isAuthPending } = useSession()
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const reset = useEditorStore((s) => s.reset)
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
  const setTopBarPopoverOpen = useEditorStore((s) => s.setTopBarPopoverOpen)
  const removeCanvas = useEditorStore((s) => s.removeCanvas)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const setBulkEditMode = useEditorStore((s) => s.setBulkEditMode)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const [showDisableDialog, setShowDisableDialog] = React.useState(false)
  const [authDialog, setAuthDialog] = React.useState<{
    open: boolean
    action: ProtectedTopBarAction
  }>({ open: false, action: "save" })
  const [shareDialog, setShareDialog] = React.useState<ShareDialogState>({
    open: false,
    status: "idle",
    url: null,
    signature: null,
    error: null,
  })
  const [shareSurface, setShareSurface] = React.useState<
    "desktop" | "mobile" | null
  >(null)
  const [isShareLinkCopied, setIsShareLinkCopied] = React.useState(false)
  const canvasIds = useEditorStore(
    useShallow((s) => s.present.canvases.map((canvas) => canvas.id))
  )
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const [isCopyingPng, setIsCopyingPng] = React.useState(false)
  const [isCopiedPng, setIsCopiedPng] = React.useState(false)

  const [includeExportWatermark, setIncludeExportWatermark] =
    React.useState(true)

  const setScreenshot = useEditorStore((s) => s.setScreenshot)
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const setScreenshotSlotImage = useEditorStore((s) => s.setScreenshotSlotImage)

  const [showNewAlert, setShowNewAlert] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [mobileSaveOpen, setMobileSaveOpen] = React.useState(false)
  const [presetNameOpen, setPresetNameOpen] = React.useState(false)
  const [draftNameOpen, setDraftNameOpen] = React.useState(false)
  const [openProjectDialogOpen, setOpenProjectDialogOpen] =
    React.useState(false)
  const [isDraftSaving, setIsDraftSaving] = React.useState(false)
  const [isPresetSaving, setIsPresetSaving] = React.useState(false)
  const [draftChoiceOpen, setDraftChoiceOpen] = React.useState(false)
  const [saveDraftMode, setSaveDraftMode] = React.useState<"auto" | "create">(
    "auto"
  )
  const currentDraft = useEditorStore((s) => s.currentDraft)
  const setCurrentDraft = useEditorStore((s) => s.setCurrentDraft)
  const loadDraftState = useEditorStore((s) => s.loadDraftState)
  const addCustomPreset = useEditorStore((s) => s.addCustomPreset)
  const updateCustomPresetInStore = useEditorStore((s) => s.updateCustomPreset)
  const setPresetTab = useEditorStore((s) => s.setPresetTab)
  const setActiveCustomPresetId = useEditorStore(
    (s) => s.setActiveCustomPresetId
  )
  const activeCustomPresetId = useEditorStore((s) => s.activeCustomPresetId)
  const customPresets = useEditorStore(useShallow((s) => s.customPresets))
  const [presetChoiceOpen, setPresetChoiceOpen] = React.useState(false)
  const [savePresetMode, setSavePresetMode] = React.useState<
    "create" | "update"
  >("create")

  const handleOpenFile = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }

      void readImageFileAsDataUrl(file, {
        downscaleAbove: 10 * 1024 * 1024,
        maxDimension: 2400,
      })
        .then((src) => {
          if (selectedScreenshotSlotId) {
            setScreenshotSlotImage(selectedScreenshotSlotId, src)
          } else {
            setScreenshot(src)
          }
          toast.success("Image opened successfully")
        })
        .catch(() => {
          toast.error("Could not read image")
        })
      e.target.value = ""
    },
    [selectedScreenshotSlotId, setScreenshot, setScreenshotSlotImage]
  )

  const handleCopyShareLink = React.useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setIsShareLinkCopied(true)
      toast.success("Share link copied")
      setTimeout(() => setIsShareLinkCopied(false), 1600)
    } catch (err) {
      console.error(err)
      toast.error("Could not copy link")
    }
  }, [])

  const handleShare = React.useCallback(async () => {
    if (shareDialog.status === "preparing") return

    const skeletonStartedAt = performance.now()
    const signature = await createShareSignature(
      activeCanvasId,
      includeExportWatermark
    )

    if (
      signature &&
      shareDialog.status === "ready" &&
      shareDialog.url &&
      shareDialog.signature === signature
    ) {
      setIsShareLinkCopied(false)
      setShareDialog((current) => ({ ...current, open: true }))
      return
    }

    setIsShareLinkCopied(false)
    setShareDialog({
      open: true,
      status: "preparing",
      url: null,
      signature: null,
      error: null,
    })

    try {
      await waitForNextPaint()
      const { blob, contentType } = await captureCanvasForShare(
        activeCanvasId,
        { watermark: includeExportWatermark }
      )
      const response = await fetch("/api/share", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": contentType,
        },
        body: blob,
      })
      const result = (await response.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Could not prepare share link")
      }

      await waitForShareSkeleton(skeletonStartedAt)
      setShareDialog({
        open: true,
        status: "ready",
        url: result.url,
        signature,
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Could not prepare share link"
      console.error("[share]", err instanceof Error ? err : String(err))
      await waitForShareSkeleton(skeletonStartedAt)
      setShareDialog({
        open: true,
        status: "error",
        url: null,
        signature: null,
        error: message,
      })
      toast.error(message)
    }
  }, [
    activeCanvasId,
    includeExportWatermark,
    shareDialog.signature,
    shareDialog.status,
    shareDialog.url,
  ])

  const handleProtectedAction = React.useCallback(
    (action: ProtectedTopBarAction) => {
      if (isAuthPending) return

      if (!session) {
        void saveCurrentEditorDraft().catch((error) => {
          console.warn("Could not save local editor state before auth", error)
        })
        setShareDialog((current) => ({ ...current, open: false }))
        setAuthDialog({ open: true, action })
        return
      }

      if (action === "share") {
        void handleShare()
        return
      }

      if (action === "save") {
        setSaveOpen(true)
        return
      }

      if (action === "open") {
        setOpenProjectDialogOpen(true)
        return
      }
    },
    [handleShare, isAuthPending, session]
  )

  const handleMobileSaveClick = React.useCallback(() => {
    if (isAuthPending) return

    if (!session) {
      void saveCurrentEditorDraft().catch((error) => {
        console.warn("Could not save local editor state before auth", error)
      })
      setShareDialog((current) => ({ ...current, open: false }))
      setAuthDialog({ open: true, action: "save" })
      return
    }

    setMobileSaveOpen(true)
  }, [isAuthPending, session])

  const handleDesktopShareClick = React.useCallback(() => {
    setShareSurface("desktop")
    handleProtectedAction("share")
  }, [handleProtectedAction])

  const handleMobileShareClick = React.useCallback(() => {
    setShareSurface("mobile")
    handleProtectedAction("share")
  }, [handleProtectedAction])

  const openSavePresetFlow = React.useCallback(() => {
    setSaveOpen(false)
    setMobileSaveOpen(false)
    if (activeCustomPresetId) {
      setPresetChoiceOpen(true)
    } else {
      setSavePresetMode("create")
      setPresetNameOpen(true)
    }
  }, [activeCustomPresetId])

  const openSaveDraftFlow = React.useCallback(() => {
    setSaveOpen(false)
    setMobileSaveOpen(false)
    if (currentDraft) {
      setDraftChoiceOpen(true)
    } else {
      setDraftNameOpen(true)
    }
  }, [currentDraft])

  const handleSaveAsPreset = React.useCallback(
    async (name: string) => {
      const state = useEditorStore.getState()
      const activeCanvas = state.present.canvases.find(
        (c) => c.id === state.present.activeCanvasId
      )
      if (!activeCanvas) {
        toast.error("No active canvas")
        return false
      }
      const aspect = activeCanvas.aspect ?? state.present.aspect
      const aw = aspect.w || 16
      const ah = aspect.h || 10
      const designWidth = BASE_CANVAS_WIDTH
      const designHeight = (BASE_CANVAS_WIDTH * ah) / aw
      const round = (n: number) => Number(n.toFixed(2))
      const geometry: CustomPresetGeometry = {
        canvasTilt: {
          rx: round(activeCanvas.tilt.rx),
          ry: round(activeCanvas.tilt.ry),
          rz: round(activeCanvas.tilt.rz),
        },
        canvasScale: round(activeCanvas.scale),
        slots: activeCanvas.screenshotSlots.map((slot) => ({
          xPct: round(slot.xPct),
          yPct: round(slot.yPct),
          widthPct: round(slot.widthPct),
          heightPct: round(slot.heightPct),
          rotation: round(slot.rotation),
          tilt: {
            rx: round(slot.tilt.rx),
            ry: round(slot.tilt.ry),
            rz: round(slot.tilt.rz),
          },
          scale: round(slot.scale),
          zIndex: slot.zIndex,
          filter: slot.filter,
          hidden: slot.hidden,
          objectFit: slot.objectFit,
          shadow: slot.shadow,
        })),
        mainOffset: {
          xPct: round(
            designWidth
              ? (activeCanvas.screenshotOffset.x / designWidth) * 100
              : 0
          ),
          yPct: round(
            designHeight
              ? (activeCanvas.screenshotOffset.y / designHeight) * 100
              : 0
          ),
        },
        canvasStyle: {
          background: activeCanvas.background,
          padding: activeCanvas.padding,
          borderRadius: activeCanvas.borderRadius,
          canvasBorderRadius: activeCanvas.canvasBorderRadius,
          border: activeCanvas.border,
          backdrop: activeCanvas.backdrop,
          screenshotPosition: activeCanvas.screenshotPosition,
          screenshotLayer: activeCanvas.screenshotLayer,
          shadow: activeCanvas.shadow,
          overlay: activeCanvas.overlay,
          frame: activeCanvas.frame,
          portrait: activeCanvas.portrait,
          enhance: activeCanvas.enhance,
          objectFit: activeCanvas.objectFit,
          frameAddress: activeCanvas.frameAddress,
          texts: activeCanvas.texts,
          assets: activeCanvas.assets,
          annotations: activeCanvas.annotations,
          annotationShapes: activeCanvas.annotationShapes,
          aspect: activeCanvas.aspect,
          tweetSettings: activeCanvas.tweet
            ? tweetSettingsFromCard(activeCanvas.tweet)
            : undefined,
        },
      }

      setIsPresetSaving(true)
      try {
        const res = await fetch("/api/presets", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, geometry }),
        })
        const data = (await res.json().catch(() => null)) as {
          preset?: CustomPresetSummary
          error?: string
        } | null
        if (!res.ok || !data?.preset) {
          throw new Error(data?.error ?? "Could not save preset")
        }
        addCustomPreset(data.preset)
        setPresetTab("custom")
        setActiveCustomPresetId(data.preset.id)
        toast.success(`Preset "${data.preset.name}" saved`)
        return true
      } catch (err) {
        console.error(err)
        const message =
          err instanceof Error ? err.message : "Could not save preset"
        toast.error(message)
        return false
      } finally {
        setIsPresetSaving(false)
      }
    },
    [addCustomPreset, setActiveCustomPresetId, setPresetTab]
  )

  const handleUpdatePreset = React.useCallback(
    async (id: string, name: string) => {
      const state = useEditorStore.getState()
      const activeCanvas = state.present.canvases.find(
        (c) => c.id === state.present.activeCanvasId
      )
      if (!activeCanvas) {
        toast.error("No active canvas")
        return false
      }
      const aspect = activeCanvas.aspect ?? state.present.aspect
      const aw = aspect.w || 16
      const ah = aspect.h || 10
      const designWidth = BASE_CANVAS_WIDTH
      const designHeight = (BASE_CANVAS_WIDTH * ah) / aw
      const round = (n: number) => Number(n.toFixed(2))
      const geometry: CustomPresetGeometry = {
        canvasTilt: {
          rx: round(activeCanvas.tilt.rx),
          ry: round(activeCanvas.tilt.ry),
          rz: round(activeCanvas.tilt.rz),
        },
        canvasScale: round(activeCanvas.scale),
        slots: activeCanvas.screenshotSlots.map((slot) => ({
          xPct: round(slot.xPct),
          yPct: round(slot.yPct),
          widthPct: round(slot.widthPct),
          heightPct: round(slot.heightPct),
          rotation: round(slot.rotation),
          tilt: {
            rx: round(slot.tilt.rx),
            ry: round(slot.tilt.ry),
            rz: round(slot.tilt.rz),
          },
          scale: round(slot.scale),
          zIndex: slot.zIndex,
          filter: slot.filter,
          hidden: slot.hidden,
          objectFit: slot.objectFit,
          shadow: slot.shadow,
        })),
        mainOffset: {
          xPct: round(
            designWidth
              ? (activeCanvas.screenshotOffset.x / designWidth) * 100
              : 0
          ),
          yPct: round(
            designHeight
              ? (activeCanvas.screenshotOffset.y / designHeight) * 100
              : 0
          ),
        },
        canvasStyle: {
          background: activeCanvas.background,
          padding: activeCanvas.padding,
          borderRadius: activeCanvas.borderRadius,
          canvasBorderRadius: activeCanvas.canvasBorderRadius,
          border: activeCanvas.border,
          backdrop: activeCanvas.backdrop,
          screenshotPosition: activeCanvas.screenshotPosition,
          screenshotLayer: activeCanvas.screenshotLayer,
          shadow: activeCanvas.shadow,
          overlay: activeCanvas.overlay,
          frame: activeCanvas.frame,
          portrait: activeCanvas.portrait,
          enhance: activeCanvas.enhance,
          objectFit: activeCanvas.objectFit,
          frameAddress: activeCanvas.frameAddress,
          texts: activeCanvas.texts,
          assets: activeCanvas.assets,
          annotations: activeCanvas.annotations,
          annotationShapes: activeCanvas.annotationShapes,
          aspect: activeCanvas.aspect,
          tweetSettings: activeCanvas.tweet
            ? tweetSettingsFromCard(activeCanvas.tweet)
            : undefined,
        },
      }
      setIsPresetSaving(true)
      try {
        const res = await fetch(`/api/presets/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, geometry }),
        })
        const data = (await res.json().catch(() => null)) as {
          preset?: CustomPresetSummary
          error?: string
        } | null
        if (!res.ok) {
          throw new Error(data?.error ?? "Could not update preset")
        }
        updateCustomPresetInStore(id, { name, geometry })
        toast.success(`Preset "${name}" updated`)
        return true
      } catch (err) {
        console.error(err)
        toast.error(
          err instanceof Error ? err.message : "Could not update preset"
        )
        return false
      } finally {
        setIsPresetSaving(false)
      }
    },
    [updateCustomPresetInStore]
  )

  const handleSaveAsDraft = React.useCallback(
    async (nameOverride?: string, mode: "auto" | "create" = "auto") => {
      const state = useEditorStore.getState()
      const existing = mode === "create" ? null : state.currentDraft
      const name = nameOverride ?? existing?.name ?? randomDisplayName()
      setIsDraftSaving(true)
      try {
        const draftState: DraftPayload = {
          schemaVersion: DRAFT_SCHEMA_VERSION,
          present: state.present,
          ui: {
            presetTab: state.presetTab,
            activeLayoutPresetId: state.activeLayoutPresetId,
            activeCustomPresetId: state.activeCustomPresetId,
            activeSinglePresetId: state.activeSinglePresetId,
            bulkEditMode: state.bulkEditMode,
            bulkViewportZoom: state.bulkViewportZoom,
            bulkScale: state.bulkScale,
            previewAutoScrollDelay: state.previewAutoScrollDelay,
            previewAnimation: state.previewAnimation,
          },
        }
        const payload = {
          name,
          state: draftState,
        }
        const url = existing ? `/api/drafts/${existing.id}` : "/api/drafts"
        const method = existing ? "PUT" : "POST"
        const res = await fetch(url, {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json().catch(() => null)) as {
          draft?: { id: string; name: string; updatedAt?: string }
          error?: string
        } | null
        if (!res.ok || !data?.draft) {
          throw new Error(data?.error ?? "Could not save draft")
        }
        const next: CurrentDraftInfo = {
          id: data.draft.id,
          name: data.draft.name,
          updatedAt: data.draft.updatedAt ?? new Date().toISOString(),
        }
        setCurrentDraft(next)
        toast.success(existing ? "Draft updated" : `Draft "${next.name}" saved`)

        void (async () => {
          try {
            const activeCanvas = state.present.canvases.find(
              (canvas) => canvas.id === state.present.activeCanvasId
            )
            const fallbackSource =
              activeCanvas?.screenshot ??
              activeCanvas?.screenshotSlots.find((slot) => slot.src)?.src ??
              null
            const thumb =
              (await captureCanvasThumbnail(state.present.activeCanvasId)) ??
              (fallbackSource
                ? await createImageThumbnailBlob(fallbackSource)
                : null)
            if (!thumb) return
            await fetch(`/api/drafts/${next.id}/thumb`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": thumb.type || "image/jpeg" },
              body: thumb,
            })
          } catch (err) {
            console.warn("Could not upload draft thumbnail", err)
          }
        })()

        return true
      } catch (err) {
        console.error(err)
        const message =
          err instanceof Error ? err.message : "Could not save draft"
        toast.error(message)
        return false
      } finally {
        setIsDraftSaving(false)
      }
    },
    [setCurrentDraft]
  )

  const handleOpenDraft = React.useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/drafts/${id}`, {
          credentials: "include",
        })
        const data = (await res.json().catch(() => null)) as {
          draft?: {
            id: string
            name: string
            updatedAt: string
            state: unknown
          }
          error?: string
        } | null
        if (!res.ok || !data?.draft?.state) {
          throw new Error(data?.error ?? "Could not load draft")
        }
        const { present, ui } = unwrapDraftState(data.draft.state)
        loadDraftState(
          present,
          {
            id: data.draft.id,
            name: data.draft.name,
            updatedAt: data.draft.updatedAt,
          },
          ui
        )
        toast.success(`Opened "${data.draft.name}"`)
        return true
      } catch (err) {
        console.error(err)
        const message =
          err instanceof Error ? err.message : "Could not load draft"
        toast.error(message)
        return false
      }
    },
    [loadDraftState]
  )

  const handleCopyPng = React.useCallback(async () => {
    if (isCopyingPng) return
    setIsCopyingPng(true)
    try {
      await copyCanvasAsPng(activeCanvasId, "1080p", {
        watermark: includeExportWatermark,
      })
      setIsCopiedPng(true)
      setTimeout(() => setIsCopiedPng(false), 1800)
    } catch (err) {
      console.error(err)
      toast.error("Copy failed. Please try again.")
    } finally {
      setIsCopyingPng(false)
    }
  }, [activeCanvasId, includeExportWatermark, isCopyingPng])

  const handleBulkEditClick = () => {
    if (!bulkEditMode) {
      setBulkEditMode(true)
    } else {
      if (canvasCount > 1) {
        setShowDisableDialog(true)
      } else {
        setBulkEditMode(false)
      }
    }
  }

  const handleDisableBulkEdit = () => {
    const toRemove = canvasIds.filter((id) => id !== activeCanvasId)
    for (const id of toRemove) {
      removeCanvas(id)
    }
    setBulkEditMode(false)
    setShowDisableDialog(false)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-dashed border-border/70 bg-background px-2 sm:px-3">
      <BrandLogo
        className="shrink-0"
        markClassName="sm:!size-10"
        wordmarkClassName="max-[380px]:hidden"
      />

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-1.5 md:flex">
        <div className="tool-cluster hidden xl:flex">
          <TopBarButton
            label="New"
            icon={RiFileAddLine}
            tooltip="New project"
            onClick={() => setShowNewAlert(true)}
          />
          <OpenControls
            currentDraftName={currentDraft?.name ?? null}
            onOpenImage={() => fileInputRef.current?.click()}
            onOpenProject={() => handleProtectedAction("open")}
          />
        </div>

        <div className="tool-cluster hidden xl:flex">
          <IconAction
            label="Undo"
            icon={RiArrowGoBackLine}
            shortcut="⌘Z"
            onClick={undo}
            disabled={!canUndo}
          />
          <IconAction
            label="Redo"
            icon={RiArrowGoForwardLine}
            shortcut="⌘⇧Z"
            onClick={redo}
            disabled={!canRedo}
          />
        </div>

        <div className="tool-cluster">
          <TopBarButton
            label="Bulk edit"
            icon={RiLayoutGridLine}
            variant={bulkEditMode ? "default" : "outline"}
            tooltip={
              bulkEditMode
                ? "Disable bulk edit"
                : "Enable bulk edit & add canvas"
            }
            onClick={handleBulkEditClick}
            className="hidden xl:inline-flex"
          />
          <TopBarButton
            label="Preview"
            icon={RiEyeLine}
            tooltip="Preview screenshot"
            onClick={() => setIsPreviewMode(true)}
            className="hidden xl:inline-flex"
          />
          <SaveControls
            open={saveOpen}
            currentDraft={currentDraft}
            isDraftSaving={isDraftSaving}
            onOpenChange={(open) => {
              setTopBarPopoverOpen(open)
              if (open) {
                handleProtectedAction("save")
              } else {
                setSaveOpen(false)
              }
            }}
            onSaveAsPreset={openSavePresetFlow}
            onSaveAsDraft={openSaveDraftFlow}
          />
          <ShareControls
            open={shareDialog.open && shareSurface === "desktop"}
            status={shareDialog.status}
            url={shareDialog.url}
            error={shareDialog.error}
            copied={isShareLinkCopied}
            onOpenChange={(open) => {
              setTopBarPopoverOpen(open)
              setShareDialog((current) => ({ ...current, open }))
              if (!open) setShareSurface(null)
            }}
            onShare={handleDesktopShareClick}
            onCopyLink={handleCopyShareLink}
            onRetry={handleShare}
          />
        </div>

        <div className="tool-cluster hidden xl:flex">
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="lg">
                    <RiRefreshLine />
                    <span>Reset</span>
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reset to defaults</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will discard all your changes and restore the editor to
                  its default state. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
                <AlertDialogCancel className="cursor-pointer">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={reset}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Dialogs mounted inside center flex so they inherit correct stacking */}
        <AlertDialog
          open={showDisableDialog}
          onOpenChange={setShowDisableDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable bulk edit?</AlertDialogTitle>
              <AlertDialogDescription>
                You have {canvasCount} canvases. Disabling bulk edit will keep
                only the active canvas and permanently delete the other{" "}
                {canvasCount - 1} canvas{canvasCount - 1 > 1 ? "es" : ""}. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
              <AlertDialogCancel className="cursor-pointer">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="cursor-pointer"
                onClick={handleDisableBulkEdit}
              >
                Delete & disable
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showNewAlert} onOpenChange={setShowNewAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start new project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will discard all your changes and restore the editor to a
                fresh canvas. This action can be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
              <AlertDialogCancel
                variant="destructive"
                className="cursor-pointer"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="cursor-pointer border-green-600/20 bg-green-600/10 text-green-600 hover:bg-green-600/20 dark:bg-green-600/20 dark:hover:bg-green-600/30"
                onClick={() => {
                  reset()
                  setShowNewAlert(false)
                }}
              >
                New Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleOpenFile}
        />

        <Dialog
          open={authDialog.open}
          onOpenChange={(open) =>
            setAuthDialog((current) => ({ ...current, open }))
          }
        >
          <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
            <div className="space-y-2 pr-8">
              <DialogTitle>Sign in to {authDialog.action}</DialogTitle>
              <DialogDescription>
                Your account is needed before this action can continue.
              </DialogDescription>
            </div>
            <LoginForm
              callbackURL="/app"
              variant="dialog"
              onBeforeSignIn={saveCurrentEditorDraft}
            />
          </DialogContent>
        </Dialog>

        <DraftChoiceDialog
          open={draftChoiceOpen}
          onOpenChange={setDraftChoiceOpen}
          draftName={currentDraft?.name ?? ""}
          isSaving={isDraftSaving}
          onUpdateExisting={async () => {
            const ok = await handleSaveAsDraft()
            if (ok) setDraftChoiceOpen(false)
          }}
          onCreateNew={() => {
            setDraftChoiceOpen(false)
            setSaveDraftMode("create")
            setDraftNameOpen(true)
          }}
        />

        <PresetChoiceDialog
          open={presetChoiceOpen}
          onOpenChange={setPresetChoiceOpen}
          presetName={
            customPresets.find((p) => p.id === activeCustomPresetId)?.name ?? ""
          }
          isSaving={isPresetSaving}
          onUpdateExisting={async () => {
            if (!activeCustomPresetId) return
            const name =
              customPresets.find((p) => p.id === activeCustomPresetId)?.name ??
              ""
            const ok = await handleUpdatePreset(activeCustomPresetId, name)
            if (ok) setPresetChoiceOpen(false)
          }}
          onCreateNew={() => {
            setPresetChoiceOpen(false)
            setSavePresetMode("create")
            setPresetNameOpen(true)
          }}
        />

        <NameDialog
          open={presetNameOpen}
          onOpenChange={setPresetNameOpen}
          title="Save as preset"
          description="Capture the current layout so you can reuse it later."
          confirmLabel="Save preset"
          loading={isPresetSaving}
          onConfirm={async (name) => {
            if (savePresetMode !== "create") return
            const ok = await handleSaveAsPreset(name)
            if (ok) setPresetNameOpen(false)
          }}
        />

        <NameDialog
          open={draftNameOpen}
          onOpenChange={setDraftNameOpen}
          title="Save as draft"
          description="Save the entire project so you can resume editing later."
          confirmLabel="Save draft"
          loading={isDraftSaving}
          onConfirm={async (name) => {
            const ok = await handleSaveAsDraft(name, saveDraftMode)
            if (ok) {
              setDraftNameOpen(false)
              setSaveDraftMode("auto")
            }
          }}
        />

        <OpenProjectDialog
          open={openProjectDialogOpen}
          onOpenChange={setOpenProjectDialogOpen}
          currentDraftId={currentDraft?.id ?? null}
          onOpenDraft={async (id) => {
            const ok = await handleOpenDraft(id)
            if (ok) setOpenProjectDialogOpen(false)
          }}
        />

        <MobileSaveDialog
          open={mobileSaveOpen}
          currentDraft={currentDraft}
          isDraftSaving={isDraftSaving}
          onOpenChange={setMobileSaveOpen}
          onSaveAsPreset={openSavePresetFlow}
          onSaveAsDraft={openSaveDraftFlow}
        />

        <MobileShareDialog
          open={shareDialog.open && shareSurface === "mobile"}
          status={shareDialog.status}
          url={shareDialog.url}
          error={shareDialog.error}
          copied={isShareLinkCopied}
          onOpenChange={(open) => {
            setShareDialog((current) => ({ ...current, open }))
            if (!open) setShareSurface(null)
          }}
          onCopyLink={handleCopyShareLink}
          onRetry={handleShare}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <div className="hidden items-center gap-1.5 xl:flex">
          <ThemeToggle />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={() => void handleCopyPng()}
                disabled={isCopyingPng}
              >
                <RiFileCopyLine />
                <span className="relative hidden xl:inline-grid [&>span]:col-start-1 [&>span]:row-start-1">
                  <span className="invisible whitespace-nowrap" aria-hidden>
                    Copying…
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={
                        isCopyingPng
                          ? "copying"
                          : isCopiedPng
                            ? "copied"
                            : "copy"
                      }
                      className="whitespace-nowrap"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.1 }}
                    >
                      {isCopyingPng
                        ? "Copying…"
                        : isCopiedPng
                          ? "Copied!"
                          : "Copy"}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy as PNG</TooltipContent>
          </Tooltip>
        </div>

        <MobileOverflowMenu
          bulkEditMode={bulkEditMode}
          onBulkEditClick={handleBulkEditClick}
          onSaveClick={handleMobileSaveClick}
          onShareClick={handleMobileShareClick}
          onCopyPng={handleCopyPng}
          isCopyingPng={isCopyingPng}
          isPreparingShare={shareDialog.status === "preparing"}
          onNewClick={() => setShowNewAlert(true)}
          onOpenClick={() => fileInputRef.current?.click()}
          onOpenProjectClick={() => handleProtectedAction("open")}
        />

        <ExportControls
          includeWatermark={includeExportWatermark}
          onIncludeWatermarkChange={setIncludeExportWatermark}
        />
      </div>
    </header>
  )
}
