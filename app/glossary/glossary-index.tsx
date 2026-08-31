"use client"

import * as React from "react"

import { useActiveSection } from "@/hooks/use-active-section"
import { cn } from "@/lib/utils"

type GlossaryIndexItem = {
  id: string
  label: string
}

export function GlossaryIndex({ items }: { items: GlossaryIndexItem[] }) {
  const [activeId, setActiveId] = useActiveSection(
    React.useMemo(() => items.map((item) => item.id), [items])
  )

  return (
    <div className="sticky top-8">
      <p className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
        {"// Letters"}
      </p>
      <div className="mt-4 grid max-w-[13rem] grid-cols-5 gap-1">
        {items.map((item) => {
          const isActive = activeId === item.id

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "flex aspect-square items-center justify-center text-xs font-medium tabular-nums transition-colors",
                isActive
                  ? "text-primary"
                  : "text-foreground/40 hover:text-foreground"
              )}
            >
              {item.label}
            </a>
          )
        })}
      </div>
    </div>
  )
}
