"use client"

import { CanvasLoading } from "@/components/editor/canvas-loading"
import { CornerMarkers } from "@/components/editor/corner-marker"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

// Kept out of `editor-skeletons` because this is the one skeleton that reads
// the store. `app/app/loading.tsx` renders the others on the server, and via
// that import the whole store graph (templates, presets, fonts, export) would
// land in the Cloudflare Worker bundle.
export function CanvasSkeleton() {
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)

  return (
    <section
      data-editor-canvas-surface
      className={cn(
        "relative z-0 flex flex-1 touch-none overflow-hidden overscroll-none bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center justify-center p-0"
          : "border-b border-dashed border-border/70"
      )}
      style={{
        containerType: "size",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      role="presentation"
    >
      <CornerMarkers className="text-border" size={12} />
      <CanvasLoading
        className={cn(
          "absolute left-1/2 origin-center -translate-x-1/2 -translate-y-1/2",
          isPreviewMode ? "top-1/2" : "top-[23%] md:top-1/2"
        )}
      />
    </section>
  )
}
