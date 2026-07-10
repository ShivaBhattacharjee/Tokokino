"use client"

import { AnimatePresence, motion } from "motion/react"

import { AnnotationToolbar } from "@/components/editor/annotation-toolbar"
import { DefaultToolbarContents } from "@/components/editor/floating-toolbar-parts/default-toolbar-contents"
import { ScreenshotMediaPill } from "@/components/editor/floating-toolbar-parts/screenshot-media-pill"
import { useBulkBarState } from "@/components/editor/floating-toolbar-parts/bulk-bar"
import { cn } from "@/lib/utils"
import { useEditor } from "@/lib/editor/store"

export { BulkBar } from "@/components/editor/floating-toolbar-parts/bulk-bar"

export function FloatingToolbar() {
  const { setActiveTool } = useEditor()
  const { isAnnotateMode } = useBulkBarState()

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-4 z-20 flex w-full max-w-[calc(100vw-1.5rem)] flex-col items-center gap-2 px-3 max-md:bottom-[150px] sm:w-auto sm:px-0 md:max-xl:left-[calc(50%+128px)]",
        // In annotate mode on mobile, anchor left so overflow scrolls right
        isAnnotateMode
          ? "left-3 max-md:translate-x-0 md:-translate-x-1/2 md:max-xl:left-[calc(50%+128px)] xl:left-1/2"
          : "left-1/2 -translate-x-1/2"
      )}
    >
      <div className="flex items-center gap-2 max-xl:flex-col">
        <AnimatePresence initial={false}>
          {!isAnnotateMode && (
            <motion.div
              key="media-pill"
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              <ScreenshotMediaPill />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          data-mode={isAnnotateMode ? "annotate" : "default"}
          className={cn(
            "pointer-events-auto flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md",
            "[scrollbar-width:none] overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            isAnnotateMode &&
              "max-w-[calc(100vw-1.5rem)] md:max-xl:max-w-[calc(100vw-300px)]"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isAnnotateMode ? "annotate" : "default"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className={cn(
                "flex items-center gap-0.5",
                isAnnotateMode ? "min-w-0 flex-1" : "min-w-max"
              )}
            >
              {isAnnotateMode ? (
                <AnnotationToolbar onExit={() => setActiveTool("pointer")} />
              ) : (
                <DefaultToolbarContents />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
