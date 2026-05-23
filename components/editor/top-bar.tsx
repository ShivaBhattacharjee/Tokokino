"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiEyeLine,
  RiFileCopyLine,
  RiLayoutGridLine,
  RiMoreLine,
  RiRefreshLine,
  RiArrowUpCircleLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiEqualizerLine,
  RiSaveLine,
  RiShareForwardLine,
  RiLink,
  RiFileAddLine,
  RiFolderOpenLine,
  RiBookmarkLine,
  RiDraftLine,
  RiImageAddLine,
  RiDiceLine,
  RiDeleteBinLine,
  RiArrowRightSLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { LoginForm } from "@/app/login/login-form"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { Switch } from "@/components/ui/switch"
import {
  MAX_CANVASES,
  saveCurrentEditorDraft,
  useEditorStore,
} from "@/lib/editor/store"
import type {
  AspectState,
  CanvasState,
  CurrentDraftInfo,
  CustomPresetGeometry,
  CustomPresetSummary,
} from "@/lib/editor/store"
import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import { randomDisplayName } from "@/lib/random-name"
import {
  DRAFT_SCHEMA_VERSION,
  type DraftPayload,
  unwrapDraftState,
} from "@/lib/schemas/draft"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  copyCanvasAsPng,
  captureCanvasForShare,
  captureCanvasThumbnail,
  createImageThumbnailBlob,
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_LABELS,
  EXPORT_RESOLUTION_LABELS,
  type ExportFormat,
  type ExportResolution,
  exportCanvas,
  getOutputDims,
} from "@/lib/editor/export"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, LayoutGroup } from "motion/react"

type ProtectedTopBarAction = "save" | "share" | "open"
type ShareDialogState = {
  open: boolean
  status: "idle" | "preparing" | "ready" | "error"
  url: string | null
  signature: string | null
  error: string | null
}

const SHARE_SKELETON_MIN_MS = 700
const CHOICE_DIALOG_NAME_LIMIT = 12

function truncateChoiceDialogName(name: string) {
  if (name.length <= CHOICE_DIALOG_NAME_LIMIT) return name
  return `${name.slice(0, CHOICE_DIALOG_NAME_LIMIT).trimEnd()}...`
}

function waitForShareSkeleton(startedAt: number) {
  const elapsed = performance.now() - startedAt
  const remaining = Math.max(0, SHARE_SKELETON_MIN_MS - elapsed)

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

function shareableCanvasSource(
  canvas: CanvasState,
  fallbackAspect: AspectState
) {
  return {
    version: 1,
    aspect: canvas.aspect ?? fallbackAspect,
    screenshot: canvas.screenshot,
    background: canvas.background,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    canvasBorderRadius: canvas.canvasBorderRadius,
    border: canvas.border,
    backdrop: canvas.backdrop,
    tilt: canvas.tilt,
    scale: canvas.scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    screenshotLayer: canvas.screenshotLayer,
    shadow: canvas.shadow,
    overlay: canvas.overlay,
    frame: canvas.frame,
    portrait: canvas.portrait,
    texts: canvas.texts,
    assets: canvas.assets,
    enhance: canvas.enhance,
    annotations: canvas.annotations,
    annotationShapes: canvas.annotationShapes,
    screenshotSlots: canvas.screenshotSlots,
    frameAddress: canvas.frameAddress,
    objectFit: canvas.objectFit,
  }
}

async function createShareSignature(
  canvasId: string,
  includeWatermark: boolean
) {
  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((item) => item.id === canvasId)
  if (!canvas) return null

  const source = stableStringify({
    canvas: shareableCanvasSource(canvas, state.present.aspect),
    includeWatermark,
  })
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

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
        toast.success(`Preset “${data.preset.name}” saved`)
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
        // A draft must round-trip the entire working state so the user can
        // resume editing exactly where they left off: canvases (with their
        // screenshot base64 pixels) live in `present`, and non-history UI
        // settings (preset tab, bulk-edit, preview cadence) live in `ui`.
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
        toast.success(existing ? "Draft updated" : `Draft “${next.name}” saved`)

        // Capture + upload a small JPEG preview so the Open Project grid has
        // something nicer than a placeholder icon. Best-effort: if capture
        // fails the save still succeeds, the grid just falls back to the
        // gradient placeholder.
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
        // Drafts may be in the new wrapped shape ({ present, ui }) or the
        // legacy raw EditorState shape — `unwrapDraftState` handles both.
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
        toast.success(`Opened “${data.draft.name}”`)
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
    // Remove all non-active canvases
    const toRemove = canvasIds.filter((id) => id !== activeCanvasId)
    for (const id of toRemove) {
      removeCanvas(id)
    }
    setBulkEditMode(false)
    setShowDisableDialog(false)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-dashed border-border/70 bg-background px-2 sm:px-3">
      {/* Brand */}
      <BrandLogo />

      {/* Center controls — compact on tablets, full labels on desktop */}
      <div className="hidden min-w-0 flex-1 items-center justify-center gap-1.5 md:flex">
        <div className="tool-cluster">
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

        <div className="tool-cluster">
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
          />
          <TopBarButton
            label="Preview"
            icon={RiEyeLine}
            tooltip="Preview screenshot"
            onClick={() => setIsPreviewMode(true)}
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
            onSaveAsPreset={() => {
              setSaveOpen(false)
              if (activeCustomPresetId) {
                setPresetChoiceOpen(true)
              } else {
                setSavePresetMode("create")
                setPresetNameOpen(true)
              }
            }}
            onSaveAsDraft={() => {
              setSaveOpen(false)
              if (currentDraft) {
                setDraftChoiceOpen(true)
              } else {
                setDraftNameOpen(true)
              }
            }}
          />
          <ShareControls
            open={shareDialog.open}
            status={shareDialog.status}
            url={shareDialog.url}
            error={shareDialog.error}
            copied={isShareLinkCopied}
            onOpenChange={(open) => {
              setTopBarPopoverOpen(open)
              setShareDialog((current) => ({ ...current, open }))
            }}
            onShare={() => handleProtectedAction("share")}
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
              <AlertDialogFooter>
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
            <AlertDialogFooter>
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
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="cursor-pointer"
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
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {/* Right cluster — desktop only */}
        <div className="hidden items-center gap-1.5 md:flex">
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

        {/* Mobile overflow menu */}
        <MobileOverflowMenu
          bulkEditMode={bulkEditMode}
          onBulkEditClick={handleBulkEditClick}
          onProtectedAction={handleProtectedAction}
          onCopyPng={handleCopyPng}
          isCopyingPng={isCopyingPng}
          isPreparingShare={shareDialog.status === "preparing"}
          onNewClick={() => setShowNewAlert(true)}
          onOpenClick={() => fileInputRef.current?.click()}
          onOpenProjectClick={() => handleProtectedAction("open")}
        />

        {/* Export (always visible) */}
        <ExportControls
          includeWatermark={includeExportWatermark}
          onIncludeWatermarkChange={setIncludeExportWatermark}
        />
      </div>
    </header>
  )
}

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg", "webp"]
const EXPORT_RESOLUTIONS: ExportResolution[] = ["hd", "4k", "8k"]
/** Widest export label — reserves button width so the toolbar does not shift */
const EXPORT_BUTTON_MAX_LABEL = `Export ${EXPORT_RESOLUTION_LABELS["hd"]} • ${EXPORT_FORMAT_LABELS.webp}`

function ExportControls({
  includeWatermark,
  onIncludeWatermarkChange,
}: {
  includeWatermark: boolean
  onIncludeWatermarkChange: (include: boolean) => void
}) {
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const canvases = useEditorStore(useShallow((s) => s.present.canvases))
  const setTopBarPopoverOpen = useEditorStore((s) => s.setTopBarPopoverOpen)
  const [format, setFormat] = React.useState<ExportFormat>("png")
  const [resolution, setResolution] = React.useState<ExportResolution>("hd")
  const [isExporting, setIsExporting] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false)

  const handleExport = React.useCallback(async () => {
    if (isExporting) return
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
    bulkEditMode,
    format,
    includeWatermark,
    resolution,
    isExporting,
  ])

  const dims = open ? getOutputDims(activeCanvasId, resolution) : null
  const dimsLabel = dims ? `${dims.width} × ${dims.height}` : "—"

  return (
    <>
      <div className="flex h-8 items-stretch overflow-hidden rounded-md bg-primary text-white shadow-sm transition-all hover:shadow-md">
        {/* Export Zone */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center gap-2 px-3.5 transition-colors hover:bg-white/10"
              onClick={() => void handleExport()}
            >
              <RiArrowUpCircleLine className="size-4 shrink-0" />
              <span className="relative inline-grid text-[12px] font-medium tracking-tight [&>span]:col-start-1 [&>span]:row-start-1">
                <span
                  className="invisible pr-0.5 whitespace-nowrap"
                  aria-hidden
                >
                  {EXPORT_BUTTON_MAX_LABEL}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isExporting ? "exporting" : "export"}
                    className="whitespace-nowrap"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {isExporting
                      ? "Exporting…"
                      : `Export ${EXPORT_RESOLUTION_LABELS[resolution]} • ${EXPORT_FORMAT_LABELS[format]}`}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Export screenshot</TooltipContent>
        </Tooltip>

        <div className="w-px bg-white/20" />

        {/* Settings Zone */}
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            setTopBarPopoverOpen(o)
          }}
        >
          <Tooltip open={open ? false : undefined}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button className="flex items-center px-2.5 transition-colors hover:bg-white/10">
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
          </PopoverContent>
        </Popover>
      </div>

      <BulkExportDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        canvases={canvases}
        format={format}
        setFormat={setFormat}
        resolution={resolution}
        setResolution={setResolution}
        includeWatermark={includeWatermark}
      />
    </>
  )
}

function BulkExportDialog({
  open,
  onOpenChange,
  canvases,
  format,
  setFormat,
  resolution,
  setResolution,
  includeWatermark,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvases: CanvasState[]
  format: ExportFormat
  setFormat: (f: ExportFormat) => void
  resolution: ExportResolution
  setResolution: (r: ExportResolution) => void
  includeWatermark: boolean
}) {
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
        {/* Header */}
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

        {/* Canvas previews grid */}
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

        {/* Format + resolution + footer */}
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
      {/* Preview */}
      <div
        ref={containerRef}
        className="relative isolate w-full overflow-hidden rounded-[6px] [&_*]:pointer-events-none"
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

      {/* Label + check indicator */}
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

function SegmentedRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <LayoutGroup
      id={`segmented-row-${options.map((opt) => opt.value).join("-")}`}
    >
      <div className="flex w-full items-center gap-1 rounded-full bg-secondary/50 p-1">
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "relative flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`segmented-pill-${options.map((o) => o.value).join("-")}`}
                  className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/60"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="rounded-full bg-secondary/60 px-2.5 py-1 font-mono text-[11px] text-foreground">
        {value}
      </span>
    </div>
  )
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  )
}

function ShareControls({
  open,
  status,
  url,
  error,
  copied,
  onOpenChange,
  onShare,
  onCopyLink,
  onRetry,
}: {
  open: boolean
  status: ShareDialogState["status"]
  url: string | null
  error: string | null
  copied: boolean
  onOpenChange: (open: boolean) => void
  onShare: () => void
  onCopyLink: (url: string) => Promise<void>
  onRetry: () => Promise<void>
}) {
  const isPreparing = status === "preparing"

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (!open && status !== "preparing") onShare()
              }}
            >
              <RiShareForwardLine />
              <span className="hidden xl:inline">Share</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Share screenshot</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),360px)] gap-3 rounded-2xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-md data-open:zoom-in-95 data-closed:zoom-out-95"
      >
        <div className="px-1">
          <p className="text-sm font-medium">Share screenshot</p>
          {isPreparing ? (
            <div className="mt-2 space-y-1.5">
              <Skeleton className="h-3 w-56 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-[80%]" />
            </div>
          ) : (
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {status === "ready"
                ? "Copy the public link or open the share page."
                : status === "error"
                  ? "The link could not be prepared."
                  : "Create a public link for this canvas."}
            </p>
          )}
        </div>

        {status === "preparing" ? (
          <div className="space-y-3">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/70 bg-secondary/40 p-2">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 rounded-md" />
              <Skeleton className="h-8 rounded-md" />
            </div>
          </div>
        ) : null}

        {status === "ready" && url ? (
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/70 bg-secondary/40 p-2">
              <RiLink className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                {url}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                className="min-w-0"
                onClick={() => void onCopyLink(url)}
              >
                {copied ? <RiCheckLine /> : <RiFileCopyLine />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>
              <Button asChild size="lg" className="min-w-0">
                <a href={url} target="_blank" rel="noreferrer">
                  <RiExternalLinkLine />
                  <span>Open</span>
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs/relaxed text-destructive">
              {error ?? "Something went wrong."}
            </p>
            <Button size="lg" className="w-full" onClick={() => void onRetry()}>
              <RiShareForwardLine />
              <span>Try again</span>
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function TopBarButton({
  label,
  icon: Icon,
  onClick,
  variant = "outline",
  tooltip,
  disabled,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  tooltip?: string
  disabled?: boolean
}) {
  const button = (
    <Button variant={variant} size="lg" onClick={onClick} disabled={disabled}>
      <Icon />
      <span className="hidden xl:inline">{label}</span>
    </Button>
  )

  if (!tooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function MobileOverflowMenu({
  bulkEditMode,
  onBulkEditClick,
  onProtectedAction,
  onCopyPng,
  isCopyingPng,
  isPreparingShare,
  onNewClick,
  onOpenClick,
  onOpenProjectClick,
}: {
  bulkEditMode: boolean
  onBulkEditClick: () => void
  onProtectedAction: (action: ProtectedTopBarAction) => void
  onCopyPng: () => Promise<void>
  isCopyingPng: boolean
  isPreparingShare: boolean
  onNewClick: () => void
  onOpenClick: () => void
  onOpenProjectClick: () => void
}) {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const reset = useEditorStore((s) => s.reset)
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
  const addCanvas = useEditorStore((s) => s.addCanvas)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const atCanvasCap = canvasCount >= MAX_CANVASES
  const [showResetAlert, setShowResetAlert] = React.useState(false)
  return (
    <>
      <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all your changes and restore the editor to its
              default state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                reset()
                setShowResetAlert(false)
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="More actions"
            className="md:hidden"
          >
            <RiMoreLine />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
            File
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onNewClick}>
            <RiFileAddLine />
            New project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenClick}>
            <RiImageAddLine />
            Open image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenProjectClick}>
            <RiFolderOpenLine />
            Open project…
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
            History
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={undo} disabled={!canUndo}>
            <RiArrowGoBackLine />
            Undo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={redo} disabled={!canRedo}>
            <RiArrowGoForwardLine />
            Redo
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
            Workspace
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onBulkEditClick}>
            <RiLayoutGridLine />
            {bulkEditMode ? "Exit bulk edit" : "Bulk edit"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={atCanvasCap}
            onClick={() => {
              const id = addCanvas()
              if (!id) toast.error(`Canvas limit reached (${MAX_CANVASES})`)
            }}
          >
            <RiAddLine />
            Add canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsPreviewMode(true)}>
            <RiEyeLine />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onProtectedAction("save")}>
            <RiSaveLine />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onProtectedAction("share")}
            disabled={isPreparingShare}
          >
            <RiShareForwardLine />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              setShowResetAlert(true)
            }}
          >
            <RiRefreshLine />
            Reset
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void onCopyPng()}
            disabled={isCopyingPng}
          >
            <RiFileCopyLine />
            {isCopyingPng ? "Copying…" : "Copy as PNG"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

function IconAction({
  label,
  icon: Icon,
  shortcut,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          aria-disabled={disabled || undefined}
          onClick={disabled ? undefined : onClick}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            disabled &&
              "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? (
          <kbd className="ml-1.5 font-mono text-[10px] opacity-80">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

function SaveControls({
  open,
  currentDraft,
  isDraftSaving,
  onOpenChange,
  onSaveAsPreset,
  onSaveAsDraft,
}: {
  open: boolean
  currentDraft: CurrentDraftInfo | null
  isDraftSaving: boolean
  onOpenChange: (open: boolean) => void
  onSaveAsPreset: () => void
  onSaveAsDraft: () => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="lg">
              <RiSaveLine />
              <span className="hidden xl:inline">Save</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Save project</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),320px)] gap-2 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-md data-open:zoom-in-95 data-closed:zoom-out-95"
      >
        <div className="px-1 pt-1 pb-2">
          <p className="text-sm font-medium">Save</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {currentDraft
              ? `Currently editing “${currentDraft.name}”.`
              : "Save the current layout or the entire project."}
          </p>
        </div>
        <SaveActionRow
          icon={RiBookmarkLine}
          title="Save as preset"
          description="Reuse this layout for new projects."
          onClick={onSaveAsPreset}
        />
        <SaveActionRow
          icon={RiDraftLine}
          title={currentDraft ? "Save draft" : "Save as draft"}
          description={
            currentDraft
              ? "Update this project so you can resume later."
              : "Save the project so you can resume editing later."
          }
          loading={isDraftSaving}
          onClick={onSaveAsDraft}
        />
      </PopoverContent>
    </Popover>
  )
}

function SaveActionRow({
  icon: Icon,
  title,
  description,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-transparent bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground/80 ring-1 ring-border/50">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {loading ? "Saving…" : title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function OpenControls({
  currentDraftName,
  onOpenImage,
  onOpenProject,
}: {
  currentDraftName: string | null
  onOpenImage: () => void
  onOpenProject: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg">
              <RiFolderOpenLine />
              <span className="hidden xl:inline">Open</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {currentDraftName ? `Editing ${currentDraftName}` : "Open"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={onOpenImage}>
          <RiImageAddLine />
          Open image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProject}>
          <RiFolderOpenLine />
          Open project…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DraftChoiceDialog({
  open,
  onOpenChange,
  draftName,
  isSaving,
  onUpdateExisting,
  onCreateNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftName: string
  isSaving: boolean
  onUpdateExisting: () => Promise<void>
  onCreateNew: () => void
}) {
  const displayDraftName = truncateChoiceDialogName(draftName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Save draft</DialogTitle>
          <DialogDescription>
            You&apos;re editing &ldquo;{displayDraftName}&rdquo;. Update it or
            save as a new draft.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <SaveActionRow
            icon={RiSaveLine}
            title="Update existing draft"
            description={`Overwrite "${displayDraftName}" with your current changes.`}
            loading={isSaving}
            onClick={() => void onUpdateExisting()}
          />
          <SaveActionRow
            icon={RiFileAddLine}
            title="Save as new draft"
            description="Keep the original and create a separate copy."
            onClick={onCreateNew}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PresetChoiceDialog({
  open,
  onOpenChange,
  presetName,
  isSaving,
  onUpdateExisting,
  onCreateNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetName: string
  isSaving: boolean
  onUpdateExisting: () => Promise<void>
  onCreateNew: () => void
}) {
  const displayPresetName = truncateChoiceDialogName(presetName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Save preset</DialogTitle>
          <DialogDescription>
            You&apos;re editing &ldquo;{displayPresetName}&rdquo;. Update it or
            save as a new preset.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <SaveActionRow
            icon={RiBookmarkLine}
            title="Update existing preset"
            description={`Overwrite "${displayPresetName}" with the current layout.`}
            loading={isSaving}
            onClick={() => void onUpdateExisting()}
          />
          <SaveActionRow
            icon={RiFileAddLine}
            title="Save as new preset"
            description="Keep the original and create a separate preset."
            onClick={onCreateNew}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  loading: boolean
  onConfirm: (name: string) => void | Promise<void>
}) {
  const [name, setName] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(randomDisplayName())
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [open])

  const rollName = React.useCallback(() => {
    setName(randomDisplayName())
    inputRef.current?.focus()
  }, [])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && !loading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-stretch gap-2">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault()
                  void onConfirm(trimmed)
                }
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={rollName}
                  aria-label="Pick a random name"
                >
                  <RiDiceLine />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Random name</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={() => void onConfirm(trimmed)}
            disabled={!canSubmit}
          >
            {loading ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type DraftListItem = {
  id: string
  name: string
  canvasCount: number
  byteSize: number
  updatedAt: string
  createdAt: string
  thumbnailUrl: string | null
}

function OpenProjectDialog({
  open,
  onOpenChange,
  currentDraftId,
  onOpenDraft,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDraftId: string | null
  onOpenDraft: (id: string) => void | Promise<void>
}) {
  const [drafts, setDrafts] = React.useState<DraftListItem[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(null)
    setError(null)
    fetch("/api/drafts", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(data?.error ?? "Could not load drafts")
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setDrafts((data as { drafts: DraftListItem[] }).drafts)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Could not load drafts")
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleOpen = async (id: string) => {
    setBusyId(id)
    try {
      await onOpenDraft(id)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Could not delete draft")
      }
      setDrafts((prev) => prev?.filter((d) => d.id !== id) ?? prev)
      toast.success("Draft removed")
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Could not delete draft")
    } finally {
      setDeletingId(null)
    }
  }

  const draftToDelete = drafts?.find((d) => d.id === confirmDeleteId) ?? null

  return (
    <>
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{draftToDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                if (confirmDeleteId) void handleDelete(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-[640px]">
          <div className="border-b border-border/60 px-5 py-4">
            <DialogTitle className="text-[15px]">Open project</DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px]">
              Pick a saved draft to resume editing.
            </DialogDescription>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4">
            {drafts === null && !error ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton
                    key={i}
                    className="aspect-[16/10] w-full rounded-lg"
                  />
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-[12px] text-destructive">
                {error}
              </div>
            ) : null}

            {drafts && drafts.length === 0 && !error ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/20 px-4 py-8 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <RiDraftLine className="size-5" />
                </span>
                <p className="text-[13px] font-medium text-foreground">
                  No saved projects yet
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Use Save → Save as draft to keep your work in the cloud.
                </p>
              </div>
            ) : null}

            {drafts && drafts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    isCurrent={currentDraftId === draft.id}
                    isOpening={busyId === draft.id}
                    isDeleting={deletingId === draft.id}
                    onOpen={() => void handleOpen(draft.id)}
                    onDelete={() => setConfirmDeleteId(draft.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/60 px-5 py-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DraftCard({
  draft,
  isCurrent,
  isOpening,
  isDeleting,
  onOpen,
  onDelete,
}: {
  draft: DraftListItem
  isCurrent: boolean
  isOpening: boolean
  isDeleting: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const updated = formatRelativeDate(draft.updatedAt)
  const [thumbError, setThumbError] = React.useState(false)
  const showThumbnail = draft.thumbnailUrl && !thumbError

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={isOpening || isDeleting}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-xl border bg-secondary/30 text-left transition-colors",
          isCurrent
            ? "border-primary"
            : "border-border/50 hover:border-primary/55",
          (isOpening || isDeleting) && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/40">
          {showThumbnail ? (
            <ShimmerImage
              src={draft.thumbnailUrl!}
              alt=""
              className="size-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/40">
              <RiDraftLine className="size-7" />
              <span className="text-[10px]">No preview</span>
            </div>
          )}
          {isCurrent ? (
            <span className="absolute top-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              Open
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground">
              {draft.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {draft.canvasCount} canvas
              {draft.canvasCount === 1 ? "" : "es"} · {updated}
            </p>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        disabled={isDeleting}
        aria-label={`Delete ${draft.name}`}
        className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-destructive/40 hover:bg-destructive/15 hover:text-destructive focus:opacity-100"
      >
        <RiDeleteBinLine className="size-3.5" />
      </button>
    </div>
  )
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return "just now"
  if (diffMs < hour) {
    const n = Math.floor(diffMs / minute)
    return `${n}m ago`
  }
  if (diffMs < day) {
    const n = Math.floor(diffMs / hour)
    return `${n}h ago`
  }
  if (diffMs < 7 * day) {
    const n = Math.floor(diffMs / day)
    return `${n}d ago`
  }
  return date.toLocaleDateString()
}
