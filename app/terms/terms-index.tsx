"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"

type TermsIndexItem = {
  id: string
  label: string
}

export function TermsIndex({ items }: { items: TermsIndexItem[] }) {
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

      const anchorLine = window.innerHeight * 0.55
      const current =
        sectionElements.findLast(
          (section) => section.getBoundingClientRect().top <= anchorLine
        ) ?? sectionElements[0]

      if (current) setActiveId(current.id)
    }

    const observer = new IntersectionObserver(syncActiveSection, {
      rootMargin: "-20% 0px -45% 0px",
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
    <div className="sticky top-8 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4 text-primary" aria-hidden />
        Agreement index
      </div>
      <ol className="space-y-1.5 text-xs leading-5">
        {items.map((item) => {
          const isActive = activeId === item.id

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block border-l py-0.5 pl-3 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                onClick={() => setActiveId(item.id)}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
