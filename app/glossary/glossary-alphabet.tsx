"use client"

import * as React from "react"

import {
  RAIL_H_RIGHT_STYLE,
  RAIL_V_STYLE,
} from "@/components/landing/rail-styles"
import { useActiveSection } from "@/hooks/use-active-section"
import { cn } from "@/lib/utils"

export type GlossaryLetter = {
  id: string
  label: string
  count: number
}

export function GlossaryAlphabet({ letters }: { letters: GlossaryLetter[] }) {
  const sectionIds = React.useMemo(
    () =>
      letters.filter((letter) => letter.count > 0).map((letter) => letter.id),
    [letters]
  )
  const [activeId, setActiveId] = useActiveSection(sectionIds)

  return (
    <nav
      aria-label="Jump to letter"
      // The bar's own background hides the container's dashed rails, so it
      // repaints them at its edges.
      style={RAIL_V_STYLE}
      className="sticky top-0 z-40 -mx-5 bg-background/85 px-5 py-2.5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
    >
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
        {letters.map((letter) => {
          if (!letter.count) {
            return (
              <span
                key={letter.id}
                aria-hidden
                className="flex size-7 items-center justify-center font-mono text-[11px] text-foreground/15 uppercase"
              >
                {letter.label}
              </span>
            )
          }

          const isActive = activeId === letter.id

          return (
            <a
              key={letter.id}
              href={`#${letter.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={() => setActiveId(letter.id)}
              className={cn(
                "flex size-7 items-center justify-center rounded-[3px] font-mono text-[11px] uppercase transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/45 hover:bg-primary/10 hover:text-primary"
              )}
            >
              {letter.label}
            </a>
          )
        })}
      </div>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={RAIL_H_RIGHT_STYLE}
      />
    </nav>
  )
}
