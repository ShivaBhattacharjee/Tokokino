"use client"

import * as React from "react"

/**
 * Tracks which of the given section ids is the one currently being read, and
 * returns it alongside a setter so a click can claim it before the scroll lands.
 */
export function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = React.useState(ids[0] ?? "")
  const idsKey = ids.join("|")

  React.useEffect(() => {
    const sectionIds = idsKey ? idsKey.split("|") : []
    if (!sectionIds.length) return

    const sectionElements = sectionIds
      .map((id) => document.getElementById(id))
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
  }, [idsKey])

  return [activeId, setActiveId] as const
}
