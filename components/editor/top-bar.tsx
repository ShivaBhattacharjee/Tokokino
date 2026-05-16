"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiDownload2Line,
  RiEyeLine,
  RiFileCopyLine,
  RiFolderOpenLine,
  RiLayoutGridLine,
  RiMoreLine,
  RiRefreshLine,
  RiSaveLine,
  RiShareForwardLine,
  RiUploadCloud2Line,
  RiLayoutMasonryLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { BrandLogo } from "@/components/editor/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { MAX_CANVASES, useEditor, useEditorStore } from "@/lib/editor/store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  copyCanvasAsPng,
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_LABELS,
  EXPORT_RESOLUTION_LABELS,
  ExportFormat,
  ExportResolution,
  exportCanvas,
  getOutputDims,
} from "@/lib/editor/export"
import { ScrollArea } from "@/components/ui/scroll-area"

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
import { cn } from "@/lib/utils"

export function TopBar() {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    setIsPreviewMode,
    removeCanvas,
    bulkEditMode,
    setBulkEditMode,
    canvasCount,
  } = useEditor()
  const [showDisableDialog, setShowDisableDialog] = React.useState(false)
  const canvases = useEditorStore((s) => s.present.canvases)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const [isCopyingPng, setIsCopyingPng] = React.useState(false)

  const handleCopyPng = React.useCallback(async () => {
    if (isCopyingPng) return
    setIsCopyingPng(true)
    try {
      await copyCanvasAsPng(activeCanvasId, "1080p")
      toast("Copied PNG · 1080p")
    } catch (err) {
      console.error(err)
      toast("Copy failed")
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
    const toRemove = canvases.filter((c) => c.id !== activeCanvasId)
    for (const c of toRemove) {
      removeCanvas(c.id)
    }
    setBulkEditMode(false)
    setShowDisableDialog(false)
    toast("Bulk edit disabled")
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
          <OpenProjectDialog compact />
          <TopBarButton
            label="Save"
            icon={RiSaveLine}
            onClick={() => toast("Saved")}
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
                  onClick={() => {
                    reset()
                    toast("Reset to defaults")
                  }}
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
                onClick={() => toast("Share link copied")}
              >
                <RiShareForwardLine />
                Share
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy a shareable link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={handleCopyPng}
                disabled={isCopyingPng}
                className="w-[104px]"
              >
                <RiFileCopyLine />
                Copy
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy as PNG</TooltipContent>
          </Tooltip>
        </div>

        {/* Mobile overflow menu */}
        <MobileOverflowMenu
          bulkEditMode={bulkEditMode}
          onBulkEditClick={handleBulkEditClick}
          onCopyPng={handleCopyPng}
          isCopyingPng={isCopyingPng}
        />

        {/* Export (always visible) */}
        <ExportControls />
      </div>
    </header>
  )
}

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpeg", "webp"]
const EXPORT_RESOLUTIONS: ExportResolution[] = ["hd", "4k", "8k"]

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
      await exportCanvas(activeCanvasId, format, resolution)
      toast(
        `Exported ${EXPORT_FORMAT_LABELS[format]} · ${EXPORT_RESOLUTION_LABELS[resolution]}`
      )
    } catch (err) {
      console.error(err)
      toast("Export failed")
    } finally {
      setIsExporting(false)
    }
  }, [activeCanvasId, format, resolution, isExporting])

  const dims = open ? getOutputDims(activeCanvasId, resolution) : null
  const dimsLabel = dims ? `${dims.width} × ${dims.height}` : "—"

  return (
    <div className="flex items-stretch">
      <Button
        size="lg"
        disabled={isExporting}
        className={cn(
          "h-8 w-[112px] rounded-r-none px-3 text-[12px] font-medium text-white"
        )}
        onClick={handleExport}
      >
        <RiDownload2Line />
        <span className="hidden sm:inline">Export</span>
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            aria-label="Export options"
            disabled={isExporting}
            className={cn(
              "h-8 rounded-l-none border-l border-white/20 px-1.5 text-white"
            )}
          >
            <RiArrowDownSLine className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-64 gap-3 rounded-xl border border-border/60 bg-popover/95 p-2 backdrop-blur-md data-open:zoom-in-100 data-closed:zoom-out-100"
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
            <SummaryRow label="Format" value={EXPORT_FORMAT_EXTENSION[format]} />
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

function OpenProjectDialog({ compact = false }: { compact?: boolean }) {
  const [activeTab, setActiveTab] = React.useState<"templates" | "projects">(
    "templates"
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="cursor-pointer">
          <RiFolderOpenLine />
          <span className={cn(compact && "hidden lg:inline")}>Open</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[640px] w-[960px] flex-col overflow-hidden border-border/60 bg-popover/95 p-0 backdrop-blur-md sm:max-w-[960px]">
        <DialogHeader className="sr-only">
          <DialogTitle>Open project</DialogTitle>
          <DialogDescription>
            Choose a template or import an existing project file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex h-full">
          {/* Left Sidebar */}
          <div className="flex w-64 flex-col gap-2 border-r border-border/60 bg-secondary/10 p-4">
            <div className="mb-6 px-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Open project
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose a template or import your existing work.
              </p>
            </div>

            <SidebarNavItem
              active={activeTab === "templates"}
              onClick={() => setActiveTab("templates")}
              icon={RiLayoutMasonryLine}
              label="Template Gallery"
              description="Start from a layout"
            />

            <SidebarNavItem
              active={activeTab === "projects"}
              onClick={() => setActiveTab("projects")}
              icon={RiUploadCloud2Line}
              label="Import Projects"
              description="Continue your work"
            />
          </div>

          {/* Right Content Area */}
          <div className="flex min-h-0 flex-1 flex-col bg-background/20">
            <div className="flex h-14 shrink-0 items-center border-b border-border/40 px-6">
              <span className="text-[13px] font-semibold tracking-wider text-foreground uppercase">
                {activeTab === "templates"
                  ? "Professional Templates"
                  : "Existing Files"}
              </span>
            </div>

            <ScrollArea className="flex-1 p-6">
              {activeTab === "templates" ? (
                <div className="grid grid-cols-2 gap-4">
                  {TEMPLATE_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className="group flex cursor-pointer flex-col gap-3 rounded-xl border-2 border-border bg-secondary/10 p-4 text-left transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/30">
                        <div className="size-full bg-gradient-to-br from-secondary/40 to-transparent transition-transform group-hover:scale-105" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3">
                  {PROJECT_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border-2 border-border bg-secondary/10 px-5 py-4 text-left transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                          <RiSaveLine className="size-5" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-foreground">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {item.updatedAt}
                          </p>
                        </div>
                      </div>
                      <RiFolderOpenLine className="size-5 text-muted-foreground/60" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SidebarNavItem({
  active,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
        active
          ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
          : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-5",
          active ? "text-white" : "text-muted-foreground"
        )}
      />
      <div>
        <p className="text-sm leading-none font-bold">{label}</p>
        <p
          className={cn(
            "mt-1.5 text-[10px] font-medium opacity-80",
            active ? "text-white" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </div>
    </button>
  )
}

function TopBarButton({
  label,
  icon: Icon,
  onClick,
  variant = "outline",
  tooltip,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  tooltip?: string
}) {
  const button = (
    <Button variant={variant} size="lg" onClick={onClick}>
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
  onCopyPng,
  isCopyingPng,
}: {
  bulkEditMode: boolean
  onBulkEditClick: () => void
  onCopyPng: () => void
  isCopyingPng: boolean
}) {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    setIsPreviewMode,
    addCanvas,
    canvasCount,
  } = useEditor()
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
                toast("Reset to defaults")
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
            File
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast("Opening…")}>
            <RiFolderOpenLine />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Saved")}>
            <RiSaveLine />
            Save
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
              if (id) toast("Canvas added")
              else toast(`Canvas limit reached (${MAX_CANVASES})`)
            }}
          >
            <RiAddLine />
            Add canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsPreviewMode(true)}>
            <RiEyeLine />
            Preview
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
          <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
            Share
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast("Share link copied")}>
            <RiShareForwardLine />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyPng} disabled={isCopyingPng}>
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

const TEMPLATE_ITEMS = [
  {
    id: "clean-gradient",
    title: "Clean Gradient",
    description: "Minimal gradient background with soft shadows",
  },
  {
    id: "terminal-window",
    title: "Terminal Window",
    description: "Code-style capture with dark shell framing",
  },
  {
    id: "social-card",
    title: "Social Card",
    description: "Square layout optimized for social sharing",
  },
]

const PROJECT_ITEMS = [
  {
    id: "landing-page-revamp",
    title: "Landing Page Revamp",
    updatedAt: "Updated 2 hours ago",
  },
  {
    id: "portfolio-hero-shot",
    title: "Portfolio Hero Shot",
    updatedAt: "Updated yesterday",
  },
  {
    id: "mobile-app-preview",
    title: "Mobile App Preview",
    updatedAt: "Updated 4 days ago",
  },
]
