"use client"

import * as React from "react"

import { LineNav, type LineNavItem } from "@/components/line-nav"
import { useActiveSection } from "@/hooks/use-active-section"

export type DocIndexItem = {
  id: string
  label: string
}

export function DocIndex({ items }: { items: DocIndexItem[] }) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const measureRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [layout, setLayout] = React.useState({ count: 1, height: 0 })
  const [activeId, setActiveId] = useActiveSection(
    React.useMemo(() => items.map((item) => item.id), [items])
  )
  const navItems = React.useMemo<LineNavItem[]>(
    () => items.map((item) => ({ title: item.label, href: `#${item.id}` })),
    [items]
  )
  const activeIndex = navItems.findIndex((item) => item.href === `#${activeId}`)

  const [previousItems, setPreviousItems] = React.useState(items)
  if (previousItems !== items) {
    setPreviousItems(items)
    setExpanded(false)
  }

  React.useEffect(() => {
    const root = rootRef.current
    const measure = measureRef.current
    if (!root || !measure) return
    let frame = 0
    const update = () => {
      const nav = measure.querySelector("nav")
      if (!nav || root.getBoundingClientRect().width === 0) return
      const rows = Array.from(nav.querySelectorAll("a"))
      const viewport = window.visualViewport
      const bottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight
      const height = Math.max(0, bottom - root.getBoundingClientRect().top - 24)
      const style = getComputedStyle(nav)
      const padding =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const rects = rows.map((row) => row.getBoundingClientRect())
      // Includes the two decorative separator lines and all three flex gaps.
      const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0
      const buttonHeight =
        (buttonRef.current?.getBoundingClientRect().height ?? 20) + 4
      const total =
        padding +
        rects.reduce((sum, rect) => sum + rect.height, 0) +
        Math.max(0, rects.length - 1) * gap
      let count = rects.length
      if (total > height) {
        count = 0
        let used = padding + buttonHeight
        for (let index = 0; index < rects.length; index++) {
          const next = used + rects[index].height + (index > 0 ? gap : 0)
          // Reserve a row for the active heading when it lies outside the prefix.
          const activeExtra =
            activeIndex > index ? rects[activeIndex].height + gap : 0
          if (next + activeExtra > height) break
          used = next
          count = index + 1
        }
      }
      setLayout((previous) =>
        previous.count === count && previous.height === height
          ? previous
          : { count, height }
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    observer.observe(measure)
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, { passive: true })
    window.visualViewport?.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("scroll", schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule)
      window.visualViewport?.removeEventListener("resize", schedule)
      window.visualViewport?.removeEventListener("scroll", schedule)
    }
  }, [navItems, activeIndex])

  const collapsedItems = navItems.slice(0, layout.count)
  if (activeIndex >= layout.count) collapsedItems.push(navItems[activeIndex])
  const hiddenCount = navItems.length - collapsedItems.length

  return (
    <div ref={rootRef} className="sticky top-8">
      {/* Same width and typography as the visible list, without focusable links. */}
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <div ref={measureRef}>
          <LineNav
            items={navItems}
            activeHref={`#${activeId}`}
            scrollActiveIntoView={false}
          />
          <button
            ref={buttonRef}
            type="button"
            className="font-mono text-[11px] tracking-widest uppercase"
          >
            + {navItems.length} more
          </button>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={layout.height ? { maxHeight: layout.height } : undefined}
      >
        <div className="scrollbar-hide min-h-0 overflow-y-auto overscroll-contain">
          <LineNav
            className="w-full"
            items={expanded ? navItems : collapsedItems}
            activeHref={`#${activeId}`}
            scrollActiveIntoView={false}
            onItemClick={(item) => setActiveId(item.href.slice(1))}
          />
        </div>
        {(hiddenCount > 0 || expanded) && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 ml-9 shrink-0 self-start font-mono text-[11px] tracking-widest text-foreground/45 uppercase transition-colors hover:text-primary"
          >
            {expanded ? "Show less" : `+ ${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  )
}
