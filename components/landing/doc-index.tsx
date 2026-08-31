"use client"

import * as React from "react"

import { LineNav, type LineNavItem } from "@/components/line-nav"
import { useActiveSection } from "@/hooks/use-active-section"

export type DocIndexItem = {
  id: string
  label: string
}

export function DocIndex({ items }: { items: DocIndexItem[] }) {
  const [activeId, setActiveId] = useActiveSection(
    React.useMemo(() => items.map((item) => item.id), [items])
  )

  const navItems = React.useMemo<LineNavItem[]>(
    () =>
      items.map((item) => ({
        title: item.label,
        href: `#${item.id}`,
      })),
    [items]
  )

  return (
    <div className="sticky top-8">
      <LineNav
        className="w-full"
        items={navItems}
        activeHref={`#${activeId}`}
        scrollActiveIntoView={false}
        onItemClick={(item) => setActiveId(item.href.slice(1))}
      />
    </div>
  )
}
