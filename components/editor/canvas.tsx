"use client"

import * as React from "react"
import { RiImage2Line } from "@remixicon/react"
import { motion } from "motion/react"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { cn } from "@/lib/utils"

type AspectId = "auto" | "16:9" | "16:10" | "4:3" | "1:1" | "3:4" | "9:16"

export function Canvas() {
  const [aspect] = React.useState<AspectId>("16:10")
  const [isDragOver, setIsDragOver] = React.useState(false)

  return (
    <section className="relative flex flex-1 items-center justify-center border-b border-dashed border-border/70 bg-background px-8 dark:bg-black">
      <CornerMarkers className="text-border" size={12} />
      <motion.div
        initial={{ opacity: 0, scale: 0.985, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "bg-dot-grid relative flex w-full max-w-[1100px] items-center justify-center rounded-2xl bg-background ring-1 ring-border/60",
          aspect === "1:1" && "aspect-square max-w-[min(70vh,800px)]",
          aspect === "16:9" && "aspect-[16/9]",
          aspect === "16:10" && "aspect-[16/10]",
          aspect === "4:3" && "aspect-[4/3]",
          aspect === "3:4" && "aspect-[3/4] max-w-[min(65vh,720px)]",
          aspect === "9:16" && "aspect-[9/16] max-w-[min(60vh,640px)]",
          aspect === "auto" && "aspect-[16/10]"
        )}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
          }}
          data-drag-over={isDragOver}
          className={cn(
            "relative m-10 flex h-[72%] w-[78%] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-foreground/15 bg-background/40 text-center backdrop-blur-sm transition-colors",
            "data-[drag-over=true]:border-foreground/50 data-[drag-over=true]:bg-foreground/5",
            "[background-image:repeating-linear-gradient(-45deg,oklch(from_var(--foreground)_l_c_h_/_0.05)_0_1px,transparent_1px_10px)]"
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm">
            <RiImage2Line className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[14px] font-medium">Drop a screenshot</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              or{" "}
              <button className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
                browse
              </button>{" "}
              · paste with{" "}
              <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border px-1 font-mono text-[10px]">
                ⌘V
              </kbd>
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

