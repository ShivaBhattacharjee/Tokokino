/**
 * This component is inspired by Devouring Details and Skiper UI.
 * Tokokino variant: strawberry (primary) line + label accents.
 */

"use client"

import { memo, useEffect, useRef } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const lineVariants = {
  normal: { width: 24 },
  active: { width: 40 },
  hover: { width: 40 },
}

export type LineNavItem = {
  title: string
  href: string
}

export type LineNavProps = {
  className?: string
  items: LineNavItem[]
  /** Href of the active item. */
  activeHref?: string
  /** Scroll the active item into view on mount. */
  scrollActiveIntoView?: boolean
  /** Called when an item is clicked. */
  onItemClick?: (
    item: LineNavItem,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => void
}

export function LineNav({
  className,
  items,
  activeHref,
  scrollActiveIntoView = true,
  onItemClick,
}: LineNavProps) {
  const activeItemRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (scrollActiveIntoView) {
      activeItemRef.current?.scrollIntoView({ block: "center" })
    }
  }, [scrollActiveIntoView])

  return (
    <nav
      className={cn("flex flex-col gap-2 py-5.25", className)}
      style={
        {
          "--line-nav-width": `${lineVariants.normal.width}px`,
        } as React.CSSProperties
      }
    >
      {items.map((item, index) => {
        const isActive = item.href === activeHref

        return (
          <LineNavItemRow
            key={item.href}
            ref={isActive ? activeItemRef : undefined}
            title={item.title}
            href={item.href}
            active={isActive}
            isLast={index === items.length - 1}
            onClick={
              onItemClick ? (event) => onItemClick(item, event) : undefined
            }
          />
        )
      })}
    </nav>
  )
}

const LineNavItemRow = memo(function LineNavItemRow({
  ref,
  title,
  href,
  active = false,
  isLast = false,
  onClick,
}: {
  ref?: React.Ref<HTMLAnchorElement>
  title: string
  href: string
  active?: boolean
  isLast?: boolean
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <>
      {/*
        Rendered as a plain anchor to stay framework-agnostic. Hash links on
        the same page use native scroll; no Next.js Link needed here.
      */}
      <motion.a
        ref={ref}
        aria-current={active ? "page" : undefined}
        className="group relative flex h-px items-center gap-3 after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:p-3.5"
        href={href}
        initial={false}
        animate={active ? "active" : "normal"}
        whileHover="hover"
        onClick={onClick}
      >
        <motion.span
          className="block h-px shrink-0 bg-primary/30 transition-[background-color] ease-out group-hover:bg-primary group-aria-[current=page]:bg-primary"
          variants={lineVariants}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        />
        <span className="text-sm whitespace-nowrap text-muted-foreground transition-[color] ease-out group-hover:text-primary group-aria-[current=page]:text-primary">
          {title}
        </span>
      </motion.a>

      {!isLast && (
        <>
          <span className="block h-px w-(--line-nav-width) bg-primary/20" />
          <span className="block h-px w-(--line-nav-width) bg-primary/20" />
        </>
      )}
    </>
  )
})
