"use client"

import React from "react"
import { motion, AnimatePresence } from "motion/react"

const SCROLL_TO_TOP_OUTLINE =
  "M20 1.5H30A8.5 8.5 0 0 1 38.5 10v20A8.5 8.5 0 0 1 30 38.5H10A8.5 8.5 0 0 1 1.5 30V10A8.5 8.5 0 0 1 10 1.5h10"

export function ScrollToTop() {
  const [visible, setVisible] = React.useState(false)
  const [scrollProgress, setScrollProgress] = React.useState(0)

  React.useEffect(() => {
    const updateScrollState = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight
      const progress =
        maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0

      setVisible(window.scrollY > 400)
      setScrollProgress(progress)
    }

    updateScrollState()
    window.addEventListener("resize", updateScrollState)
    window.addEventListener("scroll", updateScrollState, { passive: true })
    return () => {
      window.removeEventListener("resize", updateScrollState)
      window.removeEventListener("scroll", updateScrollState)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed right-6 bottom-6 z-50 size-10 rounded-md bg-background/80 text-foreground/60 shadow-md backdrop-blur-sm transition hover:text-foreground"
        >
          <svg
            viewBox="0 0 40 40"
            className="pointer-events-none absolute inset-0 size-10"
            aria-hidden="true"
          >
            <path
              d={SCROLL_TO_TOP_OUTLINE}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <path
              d={SCROLL_TO_TOP_OUTLINE}
              pathLength="1"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray={`${scrollProgress} 1`}
            />
          </svg>
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
