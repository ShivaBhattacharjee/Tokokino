"use client"

import * as React from "react"
import { Canvas } from "@/components/editor/canvas"
import { DeferredMount } from "@/components/editor/deferred-mount"
import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { EditorErrorBoundary } from "@/components/editor/error-boundary"
import {
  CanvasSkeleton,
  EffectsSidebarSkeleton,
  InspectorSkeleton,
} from "@/components/editor/editor-skeletons"
import { BulkBar, FloatingToolbar } from "@/components/editor/floating-toolbar"
import { AnimateBar } from "@/components/editor/animate/animate-bar"
import { AnimateToggle } from "@/components/editor/animate/animate-toggle"
import { AnimationLayer } from "@/components/editor/animate/animation-layer"
import { AnimationPlayerProvider } from "@/hooks/use-animation-player"
import { Inspector } from "@/components/editor/inspector"
import { IpadSidebar } from "@/components/editor/ipad-sidebar"
import { MobileControls } from "@/components/editor/mobile-controls"
import { ChromeRecommendedDialog } from "@/components/editor/chrome-recommended-dialog"
import { TopBar } from "@/components/editor/top-bar"
import { EditorProvider, useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  RiEyeLine,
  RiPlayCircleLine,
  RiSettings3Line,
  RiStopCircleLine,
} from "@remixicon/react"
import { motion, AnimatePresence } from "motion/react"

type PreviewAnimation = "slide" | "fade" | "zoom" | "flip"

const DELAY_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
]

const ANIMATION_OPTIONS: {
  label: string
  value: PreviewAnimation
  desc: string
}[] = [
  { label: "Slide", value: "slide", desc: "Classic left–right pan" },
  { label: "Fade", value: "fade", desc: "Crossfade between slides" },
  { label: "Zoom", value: "zoom", desc: "Scale in from center" },
  { label: "Flip", value: "flip", desc: "3-D card flip" },
]

function EditorLayout() {
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
  const isPreviewAutoScroll = useEditorStore((s) => s.isPreviewAutoScroll)
  const setIsPreviewAutoScroll = useEditorStore((s) => s.setIsPreviewAutoScroll)
  const previewAutoScrollDelay = useEditorStore((s) => s.previewAutoScrollDelay)
  const setPreviewAutoScrollDelay = useEditorStore(
    (s) => s.setPreviewAutoScrollDelay
  )
  const previewAnimation = useEditorStore((s) => s.previewAnimation)
  const setPreviewAnimation = useEditorStore((s) => s.setPreviewAnimation)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  // Extra screenshot slots on the active canvas → each adds a base-layer row to
  // the animate timeline, making it taller. Used to shift the canvas further up.
  const extraSlotCount = useEditorStore((s) => {
    const canvas = s.present.canvases.find(
      (c) => c.id === s.present.activeCanvasId
    )
    return canvas?.screenshotSlots?.length ?? 0
  })

  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false)
  const [floatingOpen, setFloatingOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isPreviewMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPreviewMode(false)
        setIsPreviewAutoScroll(false)
        setSettingsOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isPreviewMode, setIsPreviewMode, setIsPreviewAutoScroll])

  // Preview hides the whole editor. Animate mode keeps the top bar, side
  // panels and inspector — it only swaps the bottom floating toolbar for the
  // timeline — so `hideEditorChrome` (full hide) is preview-only.
  const hideEditorChrome = isPreviewMode
  const hideBottomToolbar = isPreviewMode || isAnimateMode

  return (
    <AnimationPlayerProvider>
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
        {!hideEditorChrome && <TopBar />}
        <AnimatePresence>
          {isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
            >
              {/* Settings panel */}
              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 10,
                      scale: 0.94,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: 8,
                      scale: 0.95,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                    className="w-64 space-y-4 rounded-2xl border border-foreground/12 bg-background/90 p-4 shadow-2xl backdrop-blur-xl"
                  >
                    {/* Delay */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-wider text-foreground/40 uppercase">
                        Slide duration
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {DELAY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPreviewAutoScrollDelay(opt.value)}
                            className={cn(
                              "cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                              previewAutoScrollDelay === opt.value
                                ? "border-transparent bg-foreground text-background"
                                : "border-foreground/12 text-foreground/60 hover:border-foreground/25 hover:text-foreground"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-wider text-foreground/40 uppercase">
                        Transition
                      </p>
                      <div className="flex gap-1">
                        {ANIMATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPreviewAnimation(opt.value)}
                            className={cn(
                              "flex-1 cursor-pointer rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-all",
                              previewAnimation === opt.value
                                ? "scale-[1.04] border-transparent bg-foreground text-background shadow-sm"
                                : "border-foreground/12 text-foreground/60 hover:scale-[1.02] hover:border-foreground/25 hover:text-foreground"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom bar */}
              <div className="flex items-center gap-2">
                {/* Play + settings pill */}
                <div className="flex h-10 items-center overflow-hidden rounded-xl border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setIsPreviewAutoScroll(!isPreviewAutoScroll)}
                    title={
                      isPreviewAutoScroll ? "Stop slideshow" : "Start slideshow"
                    }
                    className="flex h-full cursor-pointer items-center px-3 text-foreground transition-colors hover:bg-foreground/6"
                  >
                    {isPreviewAutoScroll ? (
                      <RiStopCircleLine className="size-4" />
                    ) : (
                      <RiPlayCircleLine className="size-4" />
                    )}
                  </button>
                  <div className="h-5 w-px bg-foreground/12" />
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    title="Slideshow settings"
                    className={cn(
                      "flex h-full cursor-pointer items-center px-3 transition-colors",
                      settingsOpen
                        ? "bg-foreground/8 text-foreground"
                        : "text-foreground hover:bg-foreground/6"
                    )}
                  >
                    <motion.span
                      animate={{ rotate: settingsOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="flex items-center"
                    >
                      <RiSettings3Line className="size-4" />
                    </motion.span>
                  </button>
                </div>

                {/* Exit Preview */}
                <Button
                  onClick={() => {
                    setIsPreviewMode(false)
                    setIsPreviewAutoScroll(false)
                    setSettingsOpen(false)
                  }}
                  className="h-10 cursor-pointer border border-foreground/15 bg-background/80 px-4 text-foreground shadow-xl backdrop-blur-md hover:bg-background/95"
                >
                  <RiEyeLine className="mr-2 size-4" />
                  Exit Preview
                  <kbd className="ml-2 rounded border border-foreground/15 bg-foreground/8 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
                    Esc
                  </kbd>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {!hideEditorChrome && (
            <DeferredMount
              priority={0}
              fallback={<EffectsSidebarSkeleton className="hidden xl:flex" />}
            >
              <EffectsSidebar className="hidden xl:flex" />
            </DeferredMount>
          )}
          {!hideEditorChrome && (
            <DeferredMount
              priority={0}
              fallback={
                <EffectsSidebarSkeleton className="hidden w-[264px] border-r-0! border-l border-dashed md:order-last md:flex lg:w-[288px] xl:hidden" />
              }
            >
              <IpadSidebar className="hidden md:order-last md:flex xl:hidden" />
            </DeferredMount>
          )}
          <div
            className={cn(
              "relative isolate flex min-h-0 flex-1 overflow-hidden"
            )}
            // Reserve room for the bottom timeline so the canvas shifts up into
            // the empty top space instead of sitting behind it. The timeline
            // grows by one 48px row per extra screenshot layer, so grow the
            // reserved space to match.
            style={
              isAnimateMode
                ? { paddingBottom: 120 + extraSlotCount * 48 }
                : undefined
            }
          >
            {!isAnimateMode && <BulkBar />}
            <EditorErrorBoundary
              label="Canvas"
              resetKeys={[activeCanvasId, isPreviewMode]}
            >
              <DeferredMount priority={1} fallback={<CanvasSkeleton />}>
                <Canvas />
              </DeferredMount>
            </EditorErrorBoundary>
            {/* Enter-animate trigger (still image only) */}
            {!hideBottomToolbar && <AnimateToggle />}
            {/* Animate mode: drives on-canvas motion + bottom timeline.
                AnimatePresence lets the timeline bar slide/fade out on exit
                (it defines its own enter/exit motion). */}
            {isAnimateMode && <AnimationLayer />}
            <AnimatePresence>{isAnimateMode && <AnimateBar />}</AnimatePresence>
          </div>
          {!hideBottomToolbar && (
            <div
              className={cn(
                // Phone: the toolbar is gated behind the bottom bar's tools button.
                !floatingOpen && "max-md:hidden",
                mobilePanelOpen && "max-md:hidden"
              )}
            >
              <FloatingToolbar />
            </div>
          )}
          {!isPreviewMode && (
            <DeferredMount
              priority={2}
              fallback={<InspectorSkeleton className="hidden xl:flex" />}
            >
              <Inspector
                className="hidden xl:flex"
                animateMode={isAnimateMode}
              />
            </DeferredMount>
          )}
          {!hideBottomToolbar && (
            <MobileControls
              onOpenChange={setMobilePanelOpen}
              floatingOpen={floatingOpen}
              onFloatingOpenChange={setFloatingOpen}
            />
          )}
        </div>
      </div>
    </AnimationPlayerProvider>
  )
}

export default function ScreenshotsPage() {
  return (
    <EditorProvider>
      <ChromeRecommendedDialog />
      <EditorLayout />
    </EditorProvider>
  )
}
