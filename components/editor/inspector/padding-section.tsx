"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

export function PaddingSection() {
  const { padding, setPadding } = useEditor()
  const quick = [16, 40, 80, 120]
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Inset</span>
        <EditableValue
          value={padding}
          onChange={setPadding}
          min={0}
          max={240}
          suffix="px"
        />
      </div>
      <Slider
        value={[padding]}
        onValueChange={([v]) => setPadding(v)}
        max={240}
        className="mb-3 cursor-pointer"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setPadding(q)}
            className={cn(
              "tabular h-8 rounded-md border font-mono text-[11px] transition-colors cursor-pointer",
              padding === q
                ? "border-primary/30 bg-primary text-white"
                : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-foreground/25"
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </>
  )
}
