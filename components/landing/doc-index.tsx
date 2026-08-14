"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type DocIndexItem = {
  id: string
  label: string
}

export function DocIndex({ items }: { items: DocIndexItem[] }) {
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
    <nav className="sticky top-8 flex flex-col gap-2.5 py-1">
      {items.map((item) => {
        const isActive = activeId === item.id

        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? "location" : undefined}
            onClick={() => setActiveId(item.id)}
            className="group flex items-start gap-3"
          >
            <span
              aria-hidden
              className={cn(
                "mt-[0.6rem] h-px w-6 shrink-0 bg-primary/30 transition-[width,background-color]",
                isActive && "w-10 bg-primary",
                !isActive && "group-hover:bg-primary"
              )}
            />
            <span
              className={cn(
                "text-sm leading-6 text-muted-foreground transition-colors group-hover:text-primary",
                isActive && "text-primary"
              )}
            >
              {item.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
