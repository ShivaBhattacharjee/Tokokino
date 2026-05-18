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
  RiLoader4Line,
  RiLink,
} from "@remixicon/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { LoginForm } from "@/app/login/login-form"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { MAX_CANVASES, useEditorStore } from "@/lib/editor/store"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  copyCanvasAsPng,
  captureCanvasAsPngBlob,
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

  React.useEffect(() => {
    if (!canUndo) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [canUndo])

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

    setIsShareLinkCopied(false)
    setShareDialog({
      open: true,
      status: "preparing",
      url: null,
      error: null,
    })

    try {
      const blob = await captureCanvasAsPngBlob(activeCanvasId)
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
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
            onClick={() => setIsPreviewMode(true)}
          />
          <TopBarButton
            label="Save"
            icon={RiSaveLine}
            onClick={() => handleProtectedAction("save")}
            tooltip="Save screenshot"
          />
          <TopBarButton
            label="Share"
            icon={RiShareForwardLine}
            onClick={() => handleProtectedAction("share")}
            disabled={shareDialog.status === "preparing"}
            tooltip="Share screenshot"
          />
        </div>

        <div className="tool-cluster hidden lg:flex">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg">
                <RiRefreshLine />
                <span>Reset</span>
              </Button>
            </AlertDialogTrigger>
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
        />

        {/* Export (always visible) */}
        <ExportControls />
      </div>

      <Dialog
        open={shareDialog.open}
        onOpenChange={(open) =>
          setShareDialog((current) => ({ ...current, open }))
        }
      >
        <DialogContent className="w-[min(calc(100vw-2rem),460px)] max-w-[calc(100vw-2rem)] gap-5 overflow-hidden p-5">
          <div className="space-y-2 pr-8">
            <DialogTitle>Share screenshot</DialogTitle>
            <DialogDescription>
              {shareDialog.status === "preparing"
                ? "Preparing your image and creating a public link."
                : shareDialog.status === "ready"
                  ? "Anyone with this link can view the image."
                  : shareDialog.status === "error"
                    ? "The share link could not be created."
                    : "Create a public link for this canvas."}
            </DialogDescription>
          </div>

          {shareDialog.status === "preparing" ? (
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
              <RiLoader4Line className="size-5 animate-spin text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Preparing...</p>
                <p className="text-xs text-muted-foreground">
                  Capturing the canvas and uploading it securely.
                </p>
              </div>
            </div>
          ) : null}

          {shareDialog.status === "ready" && shareDialog.url ? (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/70 bg-secondary/40 p-2">
                <RiLink className="size-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                  {shareDialog.url}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-0"
                  onClick={() => void handleCopyShareLink(shareDialog.url!)}
                >
                  {isShareLinkCopied ? <RiCheckLine /> : <RiFileCopyLine />}
                  <span>{isShareLinkCopied ? "Copied" : "Copy link"}</span>
                </Button>
                <Button asChild size="lg" className="min-w-0">
                  <a href={shareDialog.url} target="_blank" rel="noreferrer">
                    <RiExternalLinkLine />
                    <span>Open</span>
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          {shareDialog.status === "error" ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs/relaxed text-destructive">
                {shareDialog.error ?? "Something went wrong."}
              </p>
              <Button size="lg" onClick={() => void handleShare()}>
                <RiShareForwardLine />
                <span>Try again</span>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </header>
  )
}

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg", "webp"]
const EXPORT_RESOLUTIONS: ExportResolution[] = ["hd", "4k", "8k"]
/** Widest export label — reserves button width so the toolbar does not shift */
const EXPORT_BUTTON_MAX_LABEL = `Export ${EXPORT_RESOLUTION_LABELS["hd"]} • ${EXPORT_FORMAT_LABELS.webp}`

function ExportControls() {
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const [format, setFormat] = React.useState<ExportFormat>("png")
  const [resolution, setResolution] = React.useState<ExportResolution>("hd")
  const [isExporting, setIsExporting] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  const handleExport = React.useCallback(async () => {
    if (isExporting) return
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
  }, [activeCanvasId, format, resolution, isExporting])

  const dims = open ? getOutputDims(activeCanvasId, resolution) : null
  const dimsLabel = dims ? `${dims.width} × ${dims.height}` : "—"

  return (
    <div className="flex h-8 items-stretch overflow-hidden rounded-md bg-primary text-white shadow-sm transition-all hover:shadow-md">
      {/* Export Zone */}
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

      <div className="w-px bg-white/20" />

      {/* Settings Zone */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center px-2.5 transition-colors hover:bg-white/10">
            <RiEqualizerLine className="size-4" />
          </button>
        </PopoverTrigger>
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
}: {
  bulkEditMode: boolean
  onBulkEditClick: () => void
  onProtectedAction: (action: ProtectedTopBarAction) => void
  onCopyPng: () => Promise<void>
  isCopyingPng: boolean
  isPreparingShare: boolean
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
            {isPreparingShare ? "Preparing share..." : "Share"}
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
