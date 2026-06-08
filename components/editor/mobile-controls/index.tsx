"use client"

import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  RiAddLine,
  RiCloseLine,
  RiCursorLine,
  RiFullscreenLine,
  RiGalleryLine,
  RiImageAddLine,
  RiPenNibLine,
  RiSubtractLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { AnnotationToolbar } from "@/components/editor/annotation-toolbar"
import { findAspectOption } from "@/components/editor/aspect-popover"
import { MobileFramePicker } from "@/components/editor/frame-popover"
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
  MAX_SCREENSHOT_SLOTS,
  useEditorStore,
  useSelectedScreenshotSlot,
} from "@/lib/editor/store"
import type { AspectState, DeviceFrame } from "@/lib/editor/store"
import { editorValueSchemas } from "@/lib/editor/value-schemas"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { getFrameAspectCompatibilityWarning } from "@/lib/editor/frame-aspect-compatibility"
import { cn } from "@/lib/utils"

import { MobileAccountButton } from "./account-button"
import {
  ALL_CATEGORIES,
  DESIGN_CATEGORIES,
  TABS,
  TALL_CATEGORIES,
  TOOLS_CATEGORIES,
  type CategoryId,
  type TabId,
} from "./categories"
import { MobileHistoryButton } from "./history-button"
import { InlineOptions } from "./inline-options"
import { MobileToolPopoverButton } from "./tool-popover-button"

/**
 * Phone control surface (< md). Mirrors the iPad sidebar's two-tab model
 * (Design / Tools) as a centered, rounded segmented control. A floating-tools
 * button sits on the left (reveals compact canvas tools), the account bubble
 * on the right. The active tab's options are a horizontally-scrolling
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
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [annotationOpen, setAnnotationOpen] = React.useState(false)
  const [toolsOpen, setToolsOpen] = React.useState(false)
  const assetInputRef = React.useRef<HTMLInputElement>(null)

  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspect = useActiveCanvasField((c) => c.aspect)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const frame = useActiveCanvasField((c) => c.frame)
  const objectFit = useActiveCanvasField((c) => c.objectFit)
  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const tweet = useActiveCanvasField((c) => c.tweet)
  const screenshotSlots = useActiveCanvasField((c) => c.screenshotSlots)
  const scale = useActiveCanvasField((c) => c.scale)
  const texts = useActiveCanvasField((c) => c.texts)
  const setAspect = useEditorStore((s) => s.setAspect)
  const setCanvasAspect = useEditorStore((s) => s.setCanvasAspect)
  const setFrameForMatchingScreenshots = useEditorStore(
    (s) => s.setFrameForMatchingScreenshots
  )
  const selectedSlot = useSelectedScreenshotSlot()
  const activeTool = useEditorStore((s) => s.present.activeTool)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const addText = useEditorStore((s) => s.addText)
  const addAsset = useEditorStore((s) => s.addAsset)
  const addScreenshotSlot = useEditorStore((s) => s.addScreenshotSlot)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const setScale = useEditorStore((s) => s.setScale)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const setSelectedTextId = useEditorStore((s) => s.setSelectedTextId)
  const setSelectedAssetId = useEditorStore((s) => s.setSelectedAssetId)
  const setSelectedAnnotationShapeId = useEditorStore(
    (s) => s.setSelectedAnnotationShapeId
  )
  const setSelectedScreenshotSlotId = useEditorStore(
    (s) => s.setSelectedScreenshotSlotId
  )
  const setIsScreenshotSelected = useEditorStore(
    (s) => s.setIsScreenshotSelected
  )

  const frameId = frame.id
  const screenshotBoxCount = useActiveCanvasField(
    (c) => (c.screenshot ? 1 : 0) + c.screenshotSlots.length
  )
  const hasDeviceFrame = frameId !== "none"
  const showPadding = screenshotBoxCount <= 1
  const showBorder = !hasDeviceFrame
  const hasScalableContent =
    Boolean(selectedSlot?.src) ||
    Boolean(screenshot) ||
    hasDeviceFrame ||
    screenshotSlots.length > 0
  const activeScale = selectedSlot?.scale ?? scale

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
    if (c.id === "tweet") return Boolean(tweet)
    if (tweet && (c.id === "frame" || c.id === "fit" || c.id === "layout"))
      return false
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
    onOpenChange?.(drawerOpen || historyOpen || annotationOpen || toolsOpen)
  }, [annotationOpen, drawerOpen, historyOpen, onOpenChange, toolsOpen])

  const close = React.useCallback(() => {
    setActive(null)
    setHistoryOpen(false)
    setAnnotationOpen(false)
    setToolsOpen(false)
  }, [])

  const openCategory = React.useCallback(
    (id: CategoryId) => {
      setHistoryOpen(false)
      setAnnotationOpen(false)
      setToolsOpen(false)
      onFloatingOpenChange?.(false)
      setActive((prev) => (prev === id ? null : id))
    },
    [onFloatingOpenChange]
  )

  const closePanels = React.useCallback(() => {
    setHistoryOpen(false)
    setAnnotationOpen(false)
    setToolsOpen(false)
    setActive(null)
    onFloatingOpenChange?.(false)
  }, [onFloatingOpenChange])

  const addTextLayer = React.useCallback(() => {
    closePanels()
    const newId = selectedTextId ?? texts.at(-1)?.id ?? addText()
    setSelectedTextId(newId)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
    setIsScreenshotSelected(false)
    setActiveTool("pointer")
  }, [
    addText,
    closePanels,
    selectedTextId,
    setActiveTool,
    setIsScreenshotSelected,
    setSelectedAnnotationShapeId,
    setSelectedAssetId,
    setSelectedScreenshotSlotId,
    setSelectedTextId,
    texts,
  ])

  const startAnnotating = React.useCallback(() => {
    closePanels()
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
    setIsScreenshotSelected(false)
    setActiveTool("arrow")
    setAnnotationOpen(true)
  }, [
    closePanels,
    setActiveTool,
    setIsScreenshotSelected,
    setSelectedAnnotationShapeId,
    setSelectedAssetId,
    setSelectedScreenshotSlotId,
    setSelectedTextId,
  ])

  const addImageAsset = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file")
        return
      }
      void readImageFileAsDataUrl(file, {
        downscaleAbove: 10 * 1024 * 1024,
        maxDimension: 1600,
      })
        .then((src) => {
          const id = addAsset(src)
          setSelectedAssetId(id)
          setSelectedTextId(null)
          setSelectedAnnotationShapeId(null)
          setSelectedScreenshotSlotId(null)
          setIsScreenshotSelected(false)
          setActiveTool("pointer")
          setToolsOpen(false)
        })
        .catch(() => {
          toast.error("Could not read image")
        })
    },
    [
      addAsset,
      setActiveTool,
      setIsScreenshotSelected,
      setSelectedAnnotationShapeId,
      setSelectedAssetId,
      setSelectedScreenshotSlotId,
      setSelectedTextId,
    ]
  )

  const addSlot = React.useCallback(() => {
    if (tweet) {
      toast.error("Social posts use one content slot")
      return
    }
    const id = addScreenshotSlot()
    if (!id) {
      toast.error(`Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`)
      return
    }
    setSelectedScreenshotSlotId(id)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setIsScreenshotSelected(false)
    setActiveTool("pointer")
    setToolsOpen(false)
  }, [
    addScreenshotSlot,
    tweet,
    setActiveTool,
    setIsScreenshotSelected,
    setSelectedAnnotationShapeId,
    setSelectedAssetId,
    setSelectedScreenshotSlotId,
    setSelectedTextId,
  ])

  const setTool = React.useCallback(
    (tool: "pointer") => {
      setActiveTool(tool)
      setToolsOpen(false)
    },
    [setActiveTool]
  )

  const adjustScale = React.useCallback(
    (delta: number) => {
      if (!hasScalableContent) return
      const nextScale = editorValueSchemas.scale
        .catch(100)
        .parse(activeScale + delta)
      if (selectedSlot) {
        updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
        return
      }
      setScale(nextScale)
    },
    [
      activeScale,
      hasScalableContent,
      selectedSlot,
      setScale,
      updateScreenshotSlot,
    ]
  )

  const resetScale = React.useCallback(() => {
    if (!hasScalableContent) return
    const nextScale = editorValueSchemas.scale.catch(100).parse(100)
    if (selectedSlot) {
      updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
      return
    }
    setScale(nextScale)
  }, [hasScalableContent, selectedSlot, setScale, updateScreenshotSlot])

  const activeLabel =
    ALL_CATEGORIES.find((c) => c.id === inlineActive)?.label ?? "Controls"
  const penButtonActive = toolsOpen || annotationOpen || activeTool === "arrow"

  return (
    <>
      {/* Tap-away layer for panels/popovers. Annotation mode must leave the canvas touchable. */}
      {inlineActive || floatingOpen || historyOpen || toolsOpen ? (
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

      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden",
          inlineActive === "layout" ? "gap-1" : "gap-2"
        )}
      >
        {/* Scrim — keeps the flat controls legible over a bright canvas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-background via-background/85 to-transparent" />

        {/* Inline options panel (every category except Frame) */}
        <AnimatePresence>
          {inlineActive ? (
            <motion.div
              key="mobile-inline-options"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "pointer-events-auto flex w-[min(620px,calc(100vw-0.5rem))] flex-col overflow-hidden rounded-md border border-border/60 bg-sidebar/95 shadow-xl backdrop-blur",
                inlineActive === "layers"
                  ? "h-[42vh] max-h-[360px] min-h-[160px]"
                  : inlineActive === "aspect"
                    ? "h-[min(480px,70dvh)] max-h-[min(480px,70dvh)]"
                    : inlineActive === "layout"
                      ? "h-max max-h-[calc(100dvh-env(safe-area-inset-bottom)-9rem)]"
                      : TALL_CATEGORIES.has(inlineActive)
                        ? "h-[42vh] max-h-[360px] min-h-[240px]"
                        : inlineActive === "move"
                          ? "max-h-[32vh]"
                          : inlineActive === "backdrop"
                            ? "h-[32vh] max-h-[300px] min-h-[260px]"
                            : inlineActive === "background" ||
                                inlineActive === "border" ||
                                inlineActive === "shadow"
                              ? "max-h-[38vh]"
                              : "max-h-[46vh]"
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-between px-3",
                  inlineActive === "layout" ? "py-1" : "py-2"
                )}
              >
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
              <div
                className={cn(
                  "flex flex-col",
                  inlineActive === "layout"
                    ? "shrink-0 overflow-y-auto overscroll-contain"
                    : "min-h-0 flex-1"
                )}
              >
                <motion.div
                  key={inlineActive}
                  initial={{ opacity: 0.72 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className={cn(
                    "flex flex-col",
                    inlineActive === "layout" ? "shrink-0" : "min-h-0 flex-1"
                  )}
                >
                  <InlineOptions
                    id={inlineActive}
                    aspect={aspect}
                    onAspectChange={handleAspectChange}
                    onClose={close}
                  />
                </motion.div>
              </div>
            </motion.div>
          ) : null}
          {!inlineActive && annotationOpen ? (
            <motion.div
              key="mobile-annotation-options"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex w-[min(440px,calc(100vw-1rem))] overflow-hidden rounded-md border border-border/60 bg-sidebar/95 p-1 shadow-xl backdrop-blur"
            >
              <AnnotationToolbar
                onExit={() => {
                  setActiveTool("pointer")
                  setAnnotationOpen(false)
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Category chips — flat, horizontal overflow-x scroll for the active tab */}
        <div className="pointer-events-auto flex max-w-full [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
          <MobileHistoryButton
            open={historyOpen}
            onOpenChange={(open) => {
              setHistoryOpen(open)
              if (open) {
                setActive(null)
                onFloatingOpenChange?.(false)
              }
            }}
          />
          {categories.map((cat) => {
            const isActive =
              cat.id === "annotate"
                ? annotationOpen || activeTool === "arrow"
                : resolvedActive === cat.id
            const handleClick =
              cat.id === "text"
                ? addTextLayer
                : cat.id === "annotate"
                  ? startAnnotating
                  : () => openCategory(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={handleClick}
                aria-pressed={isActive}
                className={cn(
                  "flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-[#ff5a6f] bg-[#ff5a6f] text-white"
                    : "border-transparent text-foreground/60 hover:bg-[#cfe5b8]/20 hover:text-foreground dark:hover:bg-[#cfe5b8]/10"
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
          <Popover
            open={toolsOpen}
            onOpenChange={(open) => {
              setToolsOpen(open)
              if (open) {
                setHistoryOpen(false)
                setAnnotationOpen(false)
                setActive(null)
                onFloatingOpenChange?.(false)
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Tools"
                aria-pressed={penButtonActive}
                className={cn(
                  "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                  penButtonActive
                    ? "bg-[#ff5a6f] text-white"
                    : "bg-secondary/50 text-foreground/70 hover:text-foreground"
                )}
              >
                <RiPenNibLine className="size-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              forceMount
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={12}
              className="w-[min(272px,calc(100vw-2rem))] overflow-visible border-0 bg-transparent p-0 shadow-none ring-0 backdrop-blur-none"
            >
              <input
                ref={assetInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) addImageAsset(file)
                }}
              />
              <AnimatePresence>
                {toolsOpen ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="origin-bottom rounded-md border border-border/60 bg-popover/95 px-2.5 py-2 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-xl"
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <MobileToolPopoverButton
                        label="Extra Shot"
                        icon={RiGalleryLine}
                        disabled={
                          Boolean(tweet) ||
                          screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
                        }
                        onClick={addSlot}
                      />
                      <MobileToolPopoverButton
                        label="Add Asset"
                        icon={RiImageAddLine}
                        onClick={() => assetInputRef.current?.click()}
                      />
                      <MobileToolPopoverButton
                        label="Select"
                        icon={RiCursorLine}
                        active={activeTool === "pointer"}
                        onClick={() => setTool("pointer")}
                      />
                      <MobileToolPopoverButton
                        label="100%"
                        icon={RiFullscreenLine}
                        disabled={!hasScalableContent}
                        onClick={resetScale}
                      />
                    </div>
                    <div className="mt-1.5 flex w-full items-center gap-1.5 border-t border-border/60 pt-2">
                      <button
                        type="button"
                        aria-label="Zoom out"
                        disabled={!hasScalableContent || activeScale <= 10}
                        onClick={() => adjustScale(-10)}
                        className={cn(
                          "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-secondary/40 text-foreground transition-colors hover:bg-secondary/70 dark:bg-white/[0.04] dark:hover:bg-white/10",
                          (!hasScalableContent || activeScale <= 10) &&
                            "cursor-not-allowed text-foreground/35 hover:bg-secondary/40"
                        )}
                      >
                        <RiSubtractLine className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!hasScalableContent}
                        onClick={resetScale}
                        className={cn(
                          "h-9 flex-1 cursor-pointer rounded-md text-center font-mono text-[12px] text-foreground/85 transition-colors hover:bg-secondary/70 dark:hover:bg-white/5",
                          !hasScalableContent &&
                            "cursor-not-allowed text-foreground/35 hover:bg-transparent"
                        )}
                      >
                        {activeScale}%
                      </button>
                      <button
                        type="button"
                        aria-label="Zoom in"
                        disabled={!hasScalableContent || activeScale >= 300}
                        onClick={() => adjustScale(10)}
                        className={cn(
                          "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-secondary/40 text-foreground transition-colors hover:bg-secondary/70 dark:bg-white/[0.04] dark:hover:bg-white/10",
                          (!hasScalableContent || activeScale >= 300) &&
                            "cursor-not-allowed text-foreground/35 hover:bg-secondary/40"
                        )}
                      >
                        <RiAddLine className="size-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </PopoverContent>
          </Popover>

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
                        ? "text-white"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="mobile-tab-pill"
                        className="absolute inset-0 rounded-md bg-[#ff5a6f]"
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
