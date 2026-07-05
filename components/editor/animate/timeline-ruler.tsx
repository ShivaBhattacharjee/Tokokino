"use client"

import { formatShort } from "@/lib/editor/animation-timeline"
import { cn } from "@/lib/utils"

type TimelineRulerProps = {
  ticks: number[]
  durationMs: number
  pxFor: (ms: number) => number
}

/** Second-marked ruler; ticks past the current duration are dimmed. */
export function TimelineRuler({
  ticks,
  durationMs,
  pxFor,
}: TimelineRulerProps) {
  return (
    <div className="relative h-5 select-none">
      {ticks.map((t) => {
        const beyond = t * 1000 > durationMs + 1
        return (
          <div
            key={t}
            className={cn(
              "absolute top-0 flex h-full flex-col items-start transition-opacity",
              beyond && "opacity-40"
            )}
            style={{ left: pxFor(t * 1000) }}
          >
            <div className="h-2 w-px bg-border/70" />
            <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
              {formatShort(t * 1000)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
