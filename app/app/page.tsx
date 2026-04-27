"use client"

import * as React from "react"
import { Canvas } from "@/components/editor/canvas"
import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { FloatingToolbar } from "@/components/editor/floating-toolbar"
import { Inspector } from "@/components/editor/inspector"
import { IpadProSidebar } from "@/components/editor/ipad-pro-sidebar"
import { MobileControls } from "@/components/editor/mobile-controls"
import { TopBar } from "@/components/editor/top-bar"
import { EditorProvider, useEditor } from "@/lib/editor/store"
import { Button } from "@/components/ui/button"
import { RiEyeCloseLine } from "@remixicon/react"
import { motion, AnimatePresence } from "motion/react"

function EditorLayout() {
  const { isPreviewMode, setIsPreviewMode } = useEditor()

  React.useEffect(() => {
    if (!isPreviewMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPreviewMode(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isPreviewMode, setIsPreviewMode])

  return (
    <div className="flex h-svh min-h-0 flex-col bg-background">
      {!isPreviewMode && <TopBar />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {!isPreviewMode && <EffectsSidebar className="hidden xl:flex" />}
        <div className="relative isolate flex min-h-0 flex-1 overflow-hidden">
          <Canvas />
          {!isPreviewMode && <FloatingToolbar />}
          {!isPreviewMode && <IpadProSidebar />}

          <AnimatePresence>
            {isPreviewMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed top-4 right-4 z-50"
              >
                <Button
                  onClick={() => setIsPreviewMode(false)}
                  className="rounded-full shadow-xl bg-black/80 text-white hover:bg-black backdrop-blur-md px-5 cursor-pointer"
                >
                  <RiEyeCloseLine className="mr-2 size-4" />
                  Exit Preview
                  <kbd className="ml-2 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
                    Esc
                  </kbd>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!isPreviewMode && <Inspector className="hidden lg:flex" />}
        {!isPreviewMode && <MobileControls />}
      </div>
    </div>
  )
}

export default function ScreenshotsPage() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  )
}
