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
} from "@remixicon/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { LoginForm } from "@/app/login/login-form"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { MAX_CANVASES, useEditorStore } from "@/lib/editor/store"
import type { CanvasState } from "@/lib/editor/store"
import { CanvasView } from "@/components/editor/canvas"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
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
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_LABELS,
  EXPORT_RESOLUTION_LABELS,
  type ExportFormat,
  type ExportResolution,
  exportCanvas,
  getOutputDims,
} from "@/lib/editor/export"

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
import { motion, AnimatePresence } from "motion/react"

type ProtectedTopBarAction = "save" | "share"
type ShareDialogState = {
  open: boolean
  status: "idle" | "preparing" | "ready" | "error"
  url: string | null
  error: string | null
}

const SHARE_SKELETON_MIN_MS = 700

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

export function TopBar() {
  const { data: session, isPending: isAuthPending } = useSession()
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const reset = useEditorStore((s) => s.reset)
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
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
    error: null,
  })
  const [isShareLinkCopied, setIsShareLinkCopied] = React.useState(false)
  const canvasIds = useEditorStore(
    useShallow((s) => s.present.canvases.map((canvas) => canvas.id))
  )
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const [isCopyingPng, setIsCopyingPng] = React.useState(false)
  const [isCopiedPng, setIsCopiedPng] = React.useState(false)

  const setScreenshot = useEditorStore((s) => s.setScreenshot)
  const selectedScreenshotSlotId = useEditorStore((s) => s.selectedScreenshotSlotId)
  const setScreenshotSlotImage = useEditorStore((s) => s.setScreenshotSlotImage)

  const [showNewAlert, setShowNewAlert] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleOpenFile = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          if (selectedScreenshotSlotId) {
            setScreenshotSlotImage(selectedScreenshotSlotId, reader.result)
          } else {
            setScreenshot(reader.result)
          }
          toast.success("Image opened successfully")
        }
      }
      reader.readAsDataURL(file)
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

    setIsShareLinkCopied(false)
    setShareDialog({
      open: true,
      status: "preparing",
      url: null,
      error: null,
    })

    try {
      await waitForNextPaint()
      const { blob, contentType } = await captureCanvasForShare(activeCanvasId)
      const response = await fetch("/api/share", {
        method: "POST",
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
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not prepare share link"
      console.error(err)
      await waitForShareSkeleton(skeletonStartedAt)
      setShareDialog({
        open: true,
        status: "error",
        url: null,
        error: message,
      })
      toast.error(message)
    }
  }, [activeCanvasId, shareDialog.status])

  const handleProtectedAction = React.useCallback(
    (action: ProtectedTopBarAction) => {
      if (isAuthPending) return

      if (!session) {
        setShareDialog((current) => ({ ...current, open: false }))
        setAuthDialog({ open: true, action })
        return
      }

      if (action === "share") {
        void handleShare()
        return
      }

      toast("Feature in development")
    },
    [handleShare, isAuthPending, session]
  )

  const handleCopyPng = React.useCallback(async () => {
    if (isCopyingPng) return
    setIsCopyingPng(true)
    try {
      await copyCanvasAsPng(activeCanvasId, "1080p")
      setIsCopiedPng(true)
      setTimeout(() => setIsCopiedPng(false), 1800)
    } catch (err) {
      console.error(err)
      toast.error("Copy failed. Please try again.")
    } finally {
      setIsCopyingPng(false)
    }
  }, [activeCanvasId, isCopyingPng])

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
      <BrandLogo className="min-w-0 shrink-0 pr-1" />

      {/* Center controls — compact on tablets, full labels on desktop */}
      <div className="hidden min-w-0 flex-1 items-center justify-center gap-1.5 md:flex">
        <div className="tool-cluster">
          <TopBarButton
            label="New"
            icon={RiFileAddLine}
            tooltip="New project"
            onClick={() => setShowNewAlert(true)}
          />
          <TopBarButton
            label="Open"
            icon={RiFolderOpenLine}
            tooltip="Open screenshot"
            onClick={() => fileInputRef.current?.click()}
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
          <TopBarButton
            label="Save"
            icon={RiSaveLine}
            onClick={() => handleProtectedAction("save")}
            tooltip="Save screenshot"
          />
          <ShareControls
            open={shareDialog.open}
            status={shareDialog.status}
            url={shareDialog.url}
            error={shareDialog.error}
            copied={isShareLinkCopied}
            onOpenChange={(open) => {
              setShareDialog((current) => ({ ...current, open }))
            }}
            onShare={() => handleProtectedAction("share")}
            onCopyLink={handleCopyShareLink}
            onRetry={handleShare}
          />
        </div>

        <div className="tool-cluster hidden lg:flex">
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
                This will discard all your changes and restore the editor to
                a fresh canvas. This action can be undone.
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
            <LoginForm callbackURL="/app" variant="dialog" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {/* Right cluster — desktop only */}
        <div className="hidden items-center gap-1.5 xl:flex">
          <ThemeToggle />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={() => void handleCopyPng()}
              >
                <RiFileCopyLine />
                <span className="relative inline-grid [&>span]:col-start-1 [&>span]:row-start-1">
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
        />

        {/* Export (always visible) */}
        <ExportControls />
      </div>
    </header>
  )
}

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg", "webp"]
const EXPORT_RESOLUTIONS: ExportResolution[] = ["hd", "4k", "8k"]
/** Widest export label — reserves button width so the toolbar does not shift */
const EXPORT_BUTTON_MAX_LABEL = `Export ${EXPORT_RESOLUTION_LABELS["hd"]} • ${EXPORT_FORMAT_LABELS.webp}`

function ExportControls() {
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const canvases = useEditorStore(useShallow((s) => s.present.canvases))
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
      const filename = await exportCanvas(activeCanvasId, format, resolution)
      toast.success(`Saved as ${filename}`)
    } catch (err) {
      console.error(err)
      toast.error("Export failed. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }, [activeCanvasId, bulkEditMode, format, resolution, isExporting])

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
                <span className="invisible pr-0.5 whitespace-nowrap" aria-hidden>
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
        <Popover open={open} onOpenChange={setOpen}>
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvases: CanvasState[]
  format: ExportFormat
  setFormat: (f: ExportFormat) => void
  resolution: ExportResolution
  setResolution: (r: ExportResolution) => void
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
        await exportCanvas(toExport[i].id, format, resolution)
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
        <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4" style={{ maxHeight: "340px" }}>
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
    <div className="flex w-full items-center gap-1 rounded-full bg-secondary/50 p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
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
            <Button variant="outline" size="lg" onClick={onShare}>
              <RiShareForwardLine />
              <span className="hidden lg:inline">Share</span>
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
      <span className="hidden lg:inline">{label}</span>
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
}: {
  bulkEditMode: boolean
  onBulkEditClick: () => void
  onProtectedAction: (action: ProtectedTopBarAction) => void
  onCopyPng: () => Promise<void>
  isCopyingPng: boolean
  isPreparingShare: boolean
  onNewClick: () => void
  onOpenClick: () => void
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
            <RiFolderOpenLine />
            Open screenshot
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
            {isCopyingPng ? "Copying PNG…" : "Copy as PNG"}
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
