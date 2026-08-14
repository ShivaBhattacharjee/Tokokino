"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type GlossaryIndexItem = {
  id: string
  label: string
}

export function GlossaryIndex({ items }: { items: GlossaryIndexItem[] }) {
  const [activeId, setActiveId] = React.useState(items[0]?.id ?? "")

  React.useEffect(() => {
    if (!items.length) return

    const sectionElements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element))

    const syncActiveSection = () => {
      const nearPageBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 24

      if (nearPageBottom) {
        const lastSection = sectionElements.at(-1)
        if (lastSection) {
          setActiveId(lastSection.id)
        }
        return
      }

      const anchorLine = window.innerHeight * 0.4
      const current =
        sectionElements.findLast(
          (section) => section.getBoundingClientRect().top <= anchorLine
        ) ?? sectionElements[0]

      if (current) setActiveId(current.id)
    }

    const observer = new IntersectionObserver(syncActiveSection, {
      rootMargin: "-15% 0px -60% 0px",
      threshold: [0, 0.1, 0.35, 0.6],
    })

    sectionElements.forEach((section) => observer.observe(section))
    syncActiveSection()
    window.addEventListener("scroll", syncActiveSection, { passive: true })
    window.addEventListener("resize", syncActiveSection)

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", syncActiveSection)
      window.removeEventListener("resize", syncActiveSection)
    }
  }, [items])

  return (
    <div className="sticky top-8">
      <p className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
        {"// Letters"}
      </p>
      <div className="mt-4 grid grid-cols-5 gap-1">
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
