"use client"

import * as React from "react"
import { Canvas } from "@/components/editor/canvas"
import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { FloatingToolbar } from "@/components/editor/floating-toolbar"
import { Inspector } from "@/components/editor/inspector"
import { IpadProSidebar } from "@/components/editor/ipad-pro-sidebar"
import { MobileControls } from "@/components/editor/mobile-controls"
import { MobileOnlyWarning } from "@/components/editor/mobile-only-warning"
import { TopBar } from "@/components/editor/top-bar"
import { EditorProvider, useEditor } from "@/lib/editor/store"
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

const ANIMATION_OPTIONS: { label: string; value: PreviewAnimation; desc: string }[] = [
  { label: "Slide", value: "slide", desc: "Classic left–right pan" },
  { label: "Fade", value: "fade", desc: "Crossfade between slides" },
  { label: "Zoom", value: "zoom", desc: "Scale in from center" },
  { label: "Flip", value: "flip", desc: "3-D card flip" },
]

function EditorLayout() {
  const {
    isPreviewMode, setIsPreviewMode,
    isPreviewAutoScroll, setIsPreviewAutoScroll,
    previewAutoScrollDelay, setPreviewAutoScrollDelay,
    previewAnimation, setPreviewAnimation,
  } = useEditor()

  const [settingsOpen, setSettingsOpen] = React.useState(false)

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

  return (
    <div className="flex h-svh min-h-0 flex-col bg-background">
      {!isPreviewMode && <TopBar />}
      <AnimatePresence>
        {isPreviewMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            {/* Settings panel */}
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.94, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(3px)" }}
                  transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                  className="rounded-2xl border border-foreground/12 bg-background/90 shadow-2xl backdrop-blur-xl p-4 w-64 space-y-4"
                >
                  {/* Delay */}
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-foreground/40 uppercase mb-2">
                      Slide duration
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {DELAY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPreviewAutoScrollDelay(opt.value)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border",
                            previewAutoScrollDelay === opt.value
                              ? "bg-foreground text-background border-transparent"
                              : "text-foreground/60 border-foreground/12 hover:border-foreground/25 hover:text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Animation */}
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-foreground/40 uppercase mb-2">
                      Transition
                    </p>
                    <div className="flex gap-1">
                      {ANIMATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPreviewAnimation(opt.value)}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border text-center",
                            previewAnimation === opt.value
                              ? "bg-foreground text-background border-transparent scale-[1.04] shadow-sm"
                              : "text-foreground/60 border-foreground/12 hover:border-foreground/25 hover:text-foreground hover:scale-[1.02]"
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
              <div className="flex items-center rounded-xl border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-md overflow-hidden h-10">
                <button
                  type="button"
                  onClick={() => setIsPreviewAutoScroll(!isPreviewAutoScroll)}
                  title={isPreviewAutoScroll ? "Stop slideshow" : "Start slideshow"}
                  className="flex items-center px-3 h-full text-foreground hover:bg-foreground/6 transition-colors cursor-pointer"
                >
                  {isPreviewAutoScroll ? (
                    <RiStopCircleLine className="size-4" />
                  ) : (
                    <RiPlayCircleLine className="size-4" />
                  )}
                </button>
                <div className="w-px h-5 bg-foreground/12" />
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  title="Slideshow settings"
                  className={cn(
                    "flex items-center px-3 h-full transition-colors cursor-pointer",
                    settingsOpen
                      ? "text-foreground bg-foreground/8"
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
                className="cursor-pointer border border-foreground/15 bg-background/80 px-4 h-10 text-foreground shadow-xl backdrop-blur-md hover:bg-background/95"
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {!isPreviewMode && <EffectsSidebar className="hidden xl:flex" />}
        <div className="relative isolate flex min-h-0 flex-1 overflow-hidden">
          <Canvas />
          {!isPreviewMode && <FloatingToolbar />}
          {!isPreviewMode && <IpadProSidebar />}
        </div>
        {!isPreviewMode && <Inspector className="hidden md:flex" />}
        {!isPreviewMode && <MobileControls />}
      </div>
    </div>
  )
}

export default function ScreenshotsPage() {
  return (
    <EditorProvider>
      <EditorLayout />
      <MobileOnlyWarning />
    </EditorProvider>
  )
}
