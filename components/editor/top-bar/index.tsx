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
import {
  exportAnimationBlob,
  type AnimationExportProgress,
} from "@/lib/editor/animation-export"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { saveCurrentEditorDraft, useEditorStore } from "@/lib/editor/store"
import type { CurrentDraftInfo, CustomPresetSummary } from "@/lib/editor/store"
import {
  captureCustomPresetGeometry,
  resolvePresetType,
  sanitizePresentForCloudDraft,
} from "@/lib/editor/custom-preset-snapshot"
import {
  DRAFT_SCHEMA_VERSION,
  type DraftPayload,
  unwrapDraftState,
} from "@/lib/schemas/draft"
import { randomDisplayName } from "@/lib/random-name"

import { ExportControls } from "./export-controls"
import { MobileOverflowMenu } from "./mobile-overflow-menu"
import {
  MobileShareDialog,
  ShareControls,
  type AnimateShareFormat,
  type AnimateShareResolution,
  type ShareProgressState,
} from "./share-controls"
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

const ANIM_SHARE_WIDTHS: Record<AnimateShareResolution, number> = {
  hd: 1080,
  "4k": 1920,
}

export function TopBar() {
  const { data: session, isPending: isAuthPending } = useSession()
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const reset = useEditorStore((s) => s.reset)
  const hasEditorContent = useEditorStore((s) => {
    const canvas = s.present.canvases.find(
      (c) => c.id === s.present.activeCanvasId
    )
    if (!canvas) return false
    if (canvas.screenshot || canvas.originalScreenshot) return true
    if (canvas.screenshotSlots.some((slot) => slot.src)) return true
    if ((canvas.animation?.clips?.length ?? 0) > 0) return true
    if (canvas.texts.length > 0 || canvas.assets.length > 0) return true
    if (canvas.annotations.length > 0 || canvas.annotationShapes.length > 0)
      return true
    if (canvas.tweet) return true
    return s.present.canvases.length > 1
  })
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
  const setTopBarPopoverOpen = useEditorStore((s) => s.setTopBarPopoverOpen)
  const removeCanvas = useEditorStore((s) => s.removeCanvas)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const setBulkEditMode = useEditorStore((s) => s.setBulkEditMode)
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
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
    mediaKind: "style",
    storage: null,
  })
  const [shareSurface, setShareSurface] = React.useState<
    "desktop" | "mobile" | null
  >(null)
  const [isShareLinkCopied, setIsShareLinkCopied] = React.useState(false)
  const [shareAnimFormat, setShareAnimFormat] =
    React.useState<AnimateShareFormat>("mp4")
  const [shareAnimResolution, setShareAnimResolution] =
    React.useState<AnimateShareResolution>("hd")
  const [shareProgress, setShareProgress] =
    React.useState<ShareProgressState | null>(null)
  const shareAbortRef = React.useRef<AbortController | null>(null)

  const toShareProgress = React.useCallback(
    (p: AnimationExportProgress): ShareProgressState => {
      if (p.phase === "preparing") {
        return {
          phase: "preparing",
          current: p.current,
          total: p.total,
          label: "Preparing canvas…",
        }
      }
      if (p.phase === "capturing") {
        return {
          phase: "capturing",
          current: p.current,
          total: p.total,
          label: "Rendering frames…",
        }
      }
      if (p.phase === "encoding") {
        return {
          phase: "encoding",
          current: p.current,
          total: p.total,
          label: "Encoding video…",
        }
      }
      return {
        phase: "finishing",
        current: p.current,
        total: p.total,
        label: "Finishing encode…",
      }
    },
    []
  )

  const fetchShareStorage = React.useCallback(async () => {
    try {
      const res = await fetch("/api/share", { credentials: "include" })
      if (!res.ok) return null
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- res.json() is unknown under strict DOM typings
      const data = (await res.json()) as {
        storage?: { used: number; limit: number }
      }
      return data.storage ?? null
    } catch {
      return null
    }
  }, [])
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
  const hasUnsavedWork =
    canUndo || canRedo || Boolean(currentDraft) || hasEditorContent
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

    const mediaKind = isAnimateMode ? "animate" : "style"
    setIsShareLinkCopied(false)
    setShareProgress(null)

    // Animate: open configure popup first (format/resolution + storage).
    if (mediaKind === "animate") {
      setShareDialog({
        open: true,
        status: "configure",
        url: null,
        signature: null,
        error: null,
        mediaKind: "animate",
        storage: null,
      })
      const storage = await fetchShareStorage()
      setShareDialog((current) =>
        current.open && current.status === "configure"
          ? { ...current, storage }
          : current
      )
      return
    }

    const skeletonStartedAt = performance.now()
    const signature = await createShareSignature(
      activeCanvasId,
      includeExportWatermark
    )

    if (
      signature &&
      shareDialog.status === "ready" &&
      shareDialog.url &&
      shareDialog.signature === signature &&
      shareDialog.mediaKind === "style"
    ) {
      setShareDialog((current) => ({ ...current, open: true }))
      return
    }

    setShareDialog({
      open: true,
      status: "preparing",
      url: null,
      signature: null,
      error: null,
      mediaKind: "style",
      storage: null,
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
        storage?: { used: number; limit: number }
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
        mediaKind: "style",
        storage: result.storage ?? null,
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
        mediaKind: "style",
        storage: null,
      })
      toast.error(message)
    }
  }, [
    activeCanvasId,
    fetchShareStorage,
    includeExportWatermark,
    isAnimateMode,
    shareDialog.mediaKind,
    shareDialog.signature,
    shareDialog.status,
    shareDialog.url,
  ])

  const handleConfirmAnimateShare = React.useCallback(async () => {
    if (shareDialog.status === "preparing") return

    shareAbortRef.current?.abort()
    const abort = new AbortController()
    shareAbortRef.current = abort

    setShareProgress({
      phase: "preparing",
      current: 0,
      total: 1,
      label: "Preparing canvas…",
    })
    setShareDialog((current) => ({
      ...current,
      open: true,
      status: "preparing",
      url: null,
      signature: null,
      error: null,
      mediaKind: "animate",
    }))

    try {
      await waitForNextPaint()
      const { blob, contentType } = await exportAnimationBlob(activeCanvasId, {
        format: shareAnimFormat,
        fps: 30,
        targetWidth: ANIM_SHARE_WIDTHS[shareAnimResolution],
        watermark: includeExportWatermark,
        capture: "auto",
        signal: abort.signal,
        onProgress: (p) => setShareProgress(toShareProgress(p)),
      })

      setShareProgress({
        phase: "uploading",
        current: 1,
        total: 1,
        label: "Uploading share…",
      })
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
        storage?: { used: number; limit: number }
      } | null

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Could not prepare share link")
      }

      const signature = await createShareSignature(
        activeCanvasId,
        includeExportWatermark
      )
      setShareProgress(null)
      setShareDialog({
        open: true,
        status: "ready",
        url: result.url,
        signature,
        error: null,
        mediaKind: "animate",
        storage: result.storage ?? shareDialog.storage,
      })
      toast.success("Animation share link ready")
    } catch (err) {
      if (abort.signal.aborted) return
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Could not prepare share link"
      console.error("[share-animate]", err instanceof Error ? err : String(err))
      setShareProgress(null)
      const storage = await fetchShareStorage()
      setShareDialog({
        open: true,
        status: "error",
        url: null,
        signature: null,
        error: message,
        mediaKind: "animate",
        storage,
      })
      toast.error(message)
    }
  }, [
    activeCanvasId,
    fetchShareStorage,
    includeExportWatermark,
    shareAnimFormat,
    shareAnimResolution,
    shareDialog.status,
    shareDialog.storage,
    toShareProgress,
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
      const type = resolvePresetType(state.isAnimateMode, activeCanvas)
      const geometry = captureCustomPresetGeometry(activeCanvas, aspect, {
        includeAnimation: type === "animate",
      })

      setIsPresetSaving(true)
      try {
        const res = await fetch("/api/presets", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, geometry }),
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
        toast.success(
          type === "animate"
            ? `Animate preset "${data.preset.name}" saved`
            : `Preset "${data.preset.name}" saved`
        )
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
      const type = resolvePresetType(state.isAnimateMode, activeCanvas)
      const geometry = captureCustomPresetGeometry(activeCanvas, aspect, {
        includeAnimation: type === "animate",
      })
      setIsPresetSaving(true)
      try {
        const res = await fetch(`/api/presets/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, geometry }),
        })
        const data = (await res.json().catch(() => null)) as {
          preset?: CustomPresetSummary
          error?: string
        } | null
        if (!res.ok) {
          throw new Error(data?.error ?? "Could not update preset")
        }
        updateCustomPresetInStore(id, {
          name,
          type,
          geometry: data?.preset?.geometry ?? geometry,
        })
        toast.success(
          type === "animate"
            ? `Animate preset "${name}" updated`
            : `Preset "${name}" updated`
        )
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
          present: sanitizePresentForCloudDraft(state.present),
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
            isAnimateMode: state.isAnimateMode,
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
    const toastId = toast.loading("Copying to clipboard…")
    try {
      await copyCanvasAsPng(activeCanvasId, "1080p", {
        watermark: includeExportWatermark,
      })
      toast.success("Copied to clipboard", { id: toastId })
      setIsCopiedPng(true)
      setTimeout(() => setIsCopiedPng(false), 1800)
    } catch (err) {
      console.error(err)
      toast.error("Copy failed. Please try again.", { id: toastId })
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
              isAnimateMode
                ? "Not available in animate mode"
                : bulkEditMode
                  ? "Disable bulk edit"
                  : "Enable bulk edit & add canvas"
            }
            disabled={isAnimateMode}
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
            isAnimateMode={isAnimateMode}
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
            mediaKind={shareDialog.mediaKind}
            storage={shareDialog.storage}
            format={shareAnimFormat}
            resolution={shareAnimResolution}
            progress={shareProgress}
            onOpenChange={(open) => {
              setTopBarPopoverOpen(open)
              setShareDialog((current) => ({ ...current, open }))
              if (!open) {
                setShareSurface(null)
                shareAbortRef.current?.abort()
                setShareProgress(null)
              }
            }}
            onShare={handleDesktopShareClick}
            onFormatChange={setShareAnimFormat}
            onResolutionChange={setShareAnimResolution}
            onConfirmAnimateShare={() => void handleConfirmAnimateShare()}
            onCopyLink={handleCopyShareLink}
            onRetry={() => {
              if (shareDialog.mediaKind === "animate") {
                void handleConfirmAnimateShare()
              } else {
                void handleShare()
              }
            }}
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
          isAnimateMode={isAnimateMode}
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
          isAnimateMode={isAnimateMode}
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
          title={isAnimateMode ? "Save as animate preset" : "Save as preset"}
          description={
            isAnimateMode
              ? "Capture the current timeline and look so you can reuse them later."
              : "Capture the current layout so you can reuse it later."
          }
          confirmLabel={isAnimateMode ? "Save animate preset" : "Save preset"}
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
          title={isAnimateMode ? "Save as animate draft" : "Save as draft"}
          description={
            isAnimateMode
              ? "Save the entire project and timeline so you can resume editing later."
              : "Save the entire project so you can resume editing later."
          }
          confirmLabel={isAnimateMode ? "Save animate draft" : "Save draft"}
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
          hasUnsavedWork={hasUnsavedWork}
          defaultKind="style"
          onOpenDraft={async (id) => {
            const ok = await handleOpenDraft(id)
            if (ok) setOpenProjectDialogOpen(false)
          }}
          onCreateNew={() => {
            reset()
          }}
        />

        <MobileSaveDialog
          open={mobileSaveOpen}
          currentDraft={currentDraft}
          isDraftSaving={isDraftSaving}
          isAnimateMode={isAnimateMode}
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
          mediaKind={shareDialog.mediaKind}
          storage={shareDialog.storage}
          format={shareAnimFormat}
          resolution={shareAnimResolution}
          progress={shareProgress}
          onOpenChange={(open) => {
            setShareDialog((current) => ({ ...current, open }))
            if (!open) {
              setShareSurface(null)
              shareAbortRef.current?.abort()
              setShareProgress(null)
            }
          }}
          onFormatChange={setShareAnimFormat}
          onResolutionChange={setShareAnimResolution}
          onConfirmAnimateShare={() => void handleConfirmAnimateShare()}
          onCopyLink={handleCopyShareLink}
          onRetry={() => {
            if (shareDialog.mediaKind === "animate") {
              void handleConfirmAnimateShare()
            } else {
              void handleShare()
            }
          }}
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
