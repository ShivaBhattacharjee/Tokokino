"use client"

import * as React from "react"
import { motion, useScroll, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

export const hiddenScrollbarClass =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

export const ScrollFadeRootContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)

export function ScrollFadeBody({
  children,
  id,
  className,
  rootClassName,
  fadeClassName,
}: {
  children: React.ReactNode
  id?: string
  className?: string
  rootClassName?: string
  fadeClassName?: string
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [isScrollable, setIsScrollable] = React.useState(false)
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const topOpacity = useTransform(scrollYProgress, [0, 0.08], [0, 1])
  const bottomOpacity = useTransform(scrollYProgress, [0.9, 1], [1, 0])

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setIsScrollable(el.scrollHeight > el.clientHeight + 1)
  }, [])

  React.useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)

    return () => observer.disconnect()
  }, [updateScrollState])

  return (
    <div className={cn("relative min-h-0", rootClassName)}>
      <div
        id={id}
        ref={scrollRef}
        onScroll={updateScrollState}
        className={cn(
          "h-full overflow-x-hidden overflow-y-auto",
          hiddenScrollbarClass,
          className
        )}
      >
        <ScrollFadeRootContext.Provider value={scrollRef}>
          {children}
        </ScrollFadeRootContext.Provider>
      </div>
      <motion.div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-popover to-transparent",
          fadeClassName
        )}
        style={{ opacity: isScrollable ? topOpacity : 0 }}
      />
      <motion.div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-popover to-transparent",
          fadeClassName
        )}
        style={{ opacity: isScrollable ? bottomOpacity : 0 }}
      />
    </div>
  )
}
