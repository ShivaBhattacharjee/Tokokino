"use client"

import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  RiBrushLine,
  RiCloseLine,
  RiCropLine,
  RiLayoutGrid2Line,
  RiLayoutMasonryLine,
  RiMoonClearLine,
  RiPaletteLine,
  RiPenNibLine,
  RiRotateLockLine,
  RiSettingsLine,
  RiSmartphoneLine,
  RiSunLine,
  RiUserLine,
  RiGalleryLine,
  RiHardDrive2Line,
  RiLogoutBoxLine,
} from "@remixicon/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AccountAvatar } from "@/components/editor/account-avatar"
import {
  MobileAspectPicker,
  findAspectOption,
} from "@/components/editor/aspect-popover"
import { MobileFramePicker } from "@/components/editor/frame-popover"
import { PresentPresetsSection } from "@/components/editor/present-presets-section"
import { BackdropSection } from "@/components/editor/inspector/backdrop-section"
import { BackgroundSection } from "@/components/editor/inspector/background-section"
import { BorderSection } from "@/components/editor/inspector/border-section"
import { PaddingSection } from "@/components/editor/inspector/padding-section"
import { ShadowSection } from "@/components/editor/inspector/shadow-section"
import { TiltSection } from "@/components/editor/inspector/tilt-section"
import { StorageDialog } from "@/components/editor/storage-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  useActiveCanvasField,
  useEditorStore,
  useSelectedScreenshotSlot,
} from "@/lib/editor/store"
import type { AspectState, DeviceFrame } from "@/lib/editor/store"
import { getFrameAspectCompatibilityWarning } from "@/lib/editor/frame-aspect-compatibility"
import { signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type TabId = "design" | "tools"

type CategoryId =
  | "aspect"
  | "frame"
  | "layout"
  | "background"
  | "backdrop"
  | "border"
  | "padding"
  | "shadow"
  | "transform"

type Category = {
  id: CategoryId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "design", label: "Design", icon: RiLayoutMasonryLine },
  { id: "tools", label: "Tools", icon: RiSettingsLine },
]

const DESIGN_CATEGORIES: Category[] = [
  { id: "aspect", label: "Ratio", icon: RiCropLine },
  { id: "frame", label: "Frame", icon: RiSmartphoneLine },
  { id: "layout", label: "Layout", icon: RiLayoutMasonryLine },
]

const TOOLS_CATEGORIES: Category[] = [
  { id: "background", label: "Background", icon: RiPaletteLine },
  { id: "backdrop", label: "Backdrop", icon: RiSunLine },
  { id: "border", label: "Border", icon: RiBrushLine },
  { id: "padding", label: "Padding", icon: RiLayoutGrid2Line },
  { id: "shadow", label: "Shadow", icon: RiMoonClearLine },
  { id: "transform", label: "Transform", icon: RiRotateLockLine },
]

const ALL_CATEGORIES = [...DESIGN_CATEGORIES, ...TOOLS_CATEGORIES]

// Most inline panels size to their content, capped at max-h. Layout uses a
// fixed panel height so horizontal preset scrolling never changes the sheet.
const TALL_CATEGORIES = new Set<CategoryId>(["layout"])

/**
 * Phone control surface (< md). Mirrors the iPad sidebar's two-tab model
 * (Design / Tools) as a centered, rounded segmented control. A floating-tools
 * button sits on the left (reveals undo/redo + the canvas tools), the account
 * bubble on the right. The active tab's options are a horizontally-scrolling
 * chip strip; tapping a chip opens an inline options panel above the bar —
 * except Frame, which opens a searchable bottom Drawer.
 */
export function MobileControls({
  onOpenChange,
  floatingOpen,
  onFloatingOpenChange,
}: {
  onOpenChange?: (open: boolean) => void
  floatingOpen?: boolean
  onFloatingOpenChange?: (open: boolean) => void
}) {
  const [tab, setTab] = React.useState<TabId>("design")
  const [active, setActive] = React.useState<CategoryId | null>(null)

  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspect = useActiveCanvasField((c) => c.aspect)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const frame = useActiveCanvasField((c) => c.frame)
  const objectFit = useActiveCanvasField((c) => c.objectFit)
  const setAspect = useEditorStore((s) => s.setAspect)
  const setCanvasAspect = useEditorStore((s) => s.setCanvasAspect)
  const setFrameForMatchingScreenshots = useEditorStore(
    (s) => s.setFrameForMatchingScreenshots
  )
  const selectedSlot = useSelectedScreenshotSlot()

  const frameId = frame.id
  const screenshotBoxCount = useActiveCanvasField(
    (c) => (c.screenshot ? 1 : 0) + c.screenshotSlots.length
  )
  const hasDeviceFrame = frameId !== "none"
  const showPadding = screenshotBoxCount <= 1
  const showBorder = !hasDeviceFrame

  const aspect = bulkEditMode ? (canvasAspect ?? globalAspect) : globalAspect

  const showCompatibilityWarning = React.useCallback(
    (nextAspect: AspectState, nextFrame: DeviceFrame, aspectName?: string) => {
      const warning = getFrameAspectCompatibilityWarning({
        aspect: nextAspect,
        frame: nextFrame,
        aspectName,
      })
      if (!warning) return
      toast.warning(warning.title, {
        description: warning.description,
        id: "frame-aspect-compatibility",
        position: "top-center",
      })
    },
    []
  )

  const handleAspectChange = React.useCallback(
    (id: string, custom?: { w: number; h: number }) => {
      if (custom) {
        const nextAspect = { id, w: custom.w, h: custom.h }
        if (bulkEditMode) setCanvasAspect(activeCanvasId, nextAspect)
        else setAspect(nextAspect)
        showCompatibilityWarning(nextAspect, frame, "Custom size")
        return
      }
      const opt = findAspectOption(id)
      if (opt) {
        const nextAspect = { id, w: opt.w, h: opt.h }
        if (bulkEditMode) setCanvasAspect(activeCanvasId, nextAspect)
        else setAspect(nextAspect)
        showCompatibilityWarning(nextAspect, frame, opt.name)
      }
    },
    [
      bulkEditMode,
      activeCanvasId,
      setAspect,
      setCanvasAspect,
      frame,
      showCompatibilityWarning,
    ]
  )

  const handleFrameChange = React.useCallback(
    (nextFrame: DeviceFrame) => {
      setFrameForMatchingScreenshots(nextFrame)
      showCompatibilityWarning(
        aspect,
        nextFrame,
        findAspectOption(aspect.id)?.name
      )
    },
    [setFrameForMatchingScreenshots, showCompatibilityWarning, aspect]
  )

  // Filter the active tab's chips down to what's relevant for this canvas.
  const categories = (
    tab === "design" ? DESIGN_CATEGORIES : TOOLS_CATEGORIES
  ).filter((c) => {
    if (c.id === "border") return showBorder
    if (c.id === "padding") return showPadding
    return true
  })

  const resolvedActive =
    active && categories.some((c) => c.id === active) ? active : null

  // The inline panel covers everything except Frame (which uses the Drawer).
  const inlineActive = resolvedActive === "frame" ? null : resolvedActive
  const drawerOpen = resolvedActive === "frame"

  React.useEffect(() => {
    onOpenChange?.(drawerOpen)
  }, [drawerOpen, onOpenChange])

  const close = React.useCallback(() => setActive(null), [])

  const openCategory = React.useCallback(
    (id: CategoryId) => {
      onFloatingOpenChange?.(false)
      setActive((prev) => (prev === id ? null : id))
    },
    [onFloatingOpenChange]
  )

  const toggleFloating = React.useCallback(() => {
    setActive(null)
    onFloatingOpenChange?.(!floatingOpen)
  }, [floatingOpen, onFloatingOpenChange])

  const activeLabel =
    ALL_CATEGORIES.find((c) => c.id === inlineActive)?.label ?? "Controls"

  return (
    <>
      {/* Tap-away layer for the inline panel / floating tools */}
      {inlineActive || floatingOpen ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => {
            close()
            onFloatingOpenChange?.(false)
          }}
          className="fixed inset-0 z-40 cursor-default md:hidden"
        />
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden">
        {/* Scrim — keeps the flat controls legible over a bright canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-background via-background/85 to-transparent" />

        {/* Inline options panel (every category except Frame) */}
        <AnimatePresence>
          {inlineActive ? (
            <motion.div
              key={inlineActive}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "pointer-events-auto flex w-[min(440px,calc(100vw-1rem))] flex-col overflow-hidden rounded-md border border-border/60 bg-sidebar/95 shadow-xl backdrop-blur",
                TALL_CATEGORIES.has(inlineActive)
                  ? "h-[36vh] max-h-[270px] min-h-[240px]"
                  : "max-h-[46vh]"
              )}
            >
              <div className="flex shrink-0 items-center justify-between px-3 py-2">
                <span className="text-[13px] font-medium text-foreground">
                  {activeLabel}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <RiCloseLine className="size-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <InlineOptions
                  id={inlineActive}
                  aspect={aspect}
                  objectFit={objectFit}
                  onAspectChange={handleAspectChange}
                  onClose={close}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Category chips — flat, horizontal overflow-x scroll for the active tab */}
        <div className="pointer-events-auto flex max-w-full [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const isActive = resolvedActive === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => openCategory(cat.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                <cat.icon className="size-5 shrink-0" />
                <span className="whitespace-nowrap">{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main bar: [tools] · [Design | Tools] · [account] */}
        <div className="pointer-events-auto flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleFloating}
            aria-label="Tools"
            aria-pressed={floatingOpen}
            className={cn(
              "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
              floatingOpen
                ? "bg-foreground text-background"
                : "bg-secondary/50 text-foreground/70 hover:text-foreground"
            )}
          >
            <RiPenNibLine className="size-[18px]" />
          </button>

          <LayoutGroup id="mobile-tabs">
            <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1 shadow-lg backdrop-blur">
              {TABS.map((t) => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id)
                      setActive(null)
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors",
                      isActive
                        ? "text-background"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="mobile-tab-pill"
                        className="absolute inset-0 rounded-md bg-foreground"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <t.icon className="size-4" />
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </LayoutGroup>

          <MobileAccountButton />
        </div>
      </div>

      {/* Frame is the only category that opens a full Drawer (searchable list) */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DrawerContent className="h-[82vh] max-md:flex">
          <DrawerHeader className="shrink-0 px-4 pt-3 pb-2 text-left">
            <DrawerTitle>Frame</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            {drawerOpen ? (
              <MobileFramePicker
                value={frame}
                onChange={handleFrameChange}
                previewImage={selectedSlot ? selectedSlot.src : undefined}
                imageFit={selectedSlot?.objectFit ?? objectFit ?? "cover"}
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function InlineOptions({
  id,
  aspect,
  objectFit,
  onAspectChange,
  onClose,
}: {
  id: CategoryId
  aspect: AspectState
  objectFit?: "contain" | "cover" | "fill"
  onAspectChange: (id: string, custom?: { w: number; h: number }) => void
  onClose: () => void
}) {
  void objectFit

  if (id === "aspect") {
    return (
      <MobileAspectPicker
        value={aspect.id}
        onChange={onAspectChange}
        onClose={onClose}
      />
    )
  }

  if (id === "layout") {
    return <PresentPresetsSection flat horizontal showPresetHeading={false} />
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 pb-6">
      <div>
        {id === "background" ? <BackgroundSection /> : null}
        {id === "backdrop" ? <BackdropSection popoverSide="top" /> : null}
        {id === "border" ? <BorderSection /> : null}
        {id === "padding" ? <PaddingSection /> : null}
        {id === "shadow" ? <ShadowSection /> : null}
        {id === "transform" ? <TiltSection /> : null}
      </div>
    </div>
  )
}

function MobileAccountButton() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [storageOpen, setStorageOpen] = React.useState(false)
  const user = session?.user

  const triggerClass =
    "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary/50 text-foreground/70 transition-colors hover:text-foreground"

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push("/login")}
        className={triggerClass}
        aria-label="Sign in"
      >
        <RiUserLine className="size-[18px]" />
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Account">
          <AccountAvatar
            src={user.image}
            name={user.name}
            className="size-7 rounded-full ring-1 ring-border/70"
            iconClassName="size-[18px]"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-48 p-1"
      >
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            router.push("/app/shares")
          }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
        >
          <RiGalleryLine className="size-4 text-muted-foreground" />
          My Shares
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setStorageOpen(true)
          }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
        >
          <RiHardDrive2Line className="size-4 text-muted-foreground" />
          Storage
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            void signOut()
          }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
        >
          <RiLogoutBoxLine className="size-4" />
          Sign out
        </button>
      </PopoverContent>
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} />
    </Popover>
  )
}
