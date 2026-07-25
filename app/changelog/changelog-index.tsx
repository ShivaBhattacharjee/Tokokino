"use client"

import * as React from "react"

import { LineNav, type LineNavItem } from "@/components/line-nav"

export type ChangelogIndexItem = {
  id: string
  label: string
}

export function ChangelogIndex({ items }: { items: ChangelogIndexItem[] }) {
  const navItems = React.useMemo<LineNavItem[]>(
    () =>
      items.map((item) => ({
        title: item.label,
        href: `#${item.id}`,
      })),
    [items]
  )

  const [activeHref, setActiveHref] = React.useState(navItems[0]?.href ?? "")

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
          setActiveHref(`#${lastSection.id}`)
        }
        return
      }

      const anchorLine = window.innerHeight * 0.4
      const current =
        sectionElements.findLast(
          (section) => section.getBoundingClientRect().top <= anchorLine
        ) ?? sectionElements[0]

      if (current) setActiveHref(`#${current.id}`)
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
      <LineNav
        className="w-full"
        items={navItems}
        activeHref={activeHref}
        scrollActiveIntoView={false}
        onItemClick={(item) => setActiveHref(item.href)}
      />
    </div>
  )
}
