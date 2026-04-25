"use client"

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
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-50"
              >
                <Button 
                  onClick={() => setIsPreviewMode(false)}
                  className="rounded-full shadow-xl bg-black/80 text-white hover:bg-black backdrop-blur-md px-6 cursor-pointer"
                >
                  <RiEyeCloseLine className="mr-2 size-4" />
                  Exit Preview
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
