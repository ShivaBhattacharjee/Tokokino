"use client"

import * as React from "react"
import { RiChromeLine } from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  acknowledgeChromeRecommendedWarning,
  shouldShowChromeRecommendedWarning,
} from "@/lib/browser-support"

/** Let the editor paint first so the modal eases in instead of slamming open. */
const OPEN_DELAY_MS = 400

const ease = [0.22, 1, 0.36, 1] as const

/**
 * One-time modal for Safari / Firefox (and other non-Chromium browsers).
 * Tokokino is designed for Chrome; animation export and a few canvas APIs
 * are less reliable elsewhere.
 *
 * Uses motion/react (Framer Motion). Keep the enter cheap: no backdrop-blur
 * (kills Safari FPS) and a single transform/opacity tween on the panel.
 */
export function ChromeRecommendedDialog() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!shouldShowChromeRecommendedWarning()) return
    const id = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])

  const acknowledge = React.useCallback(() => {
    acknowledgeChromeRecommendedWarning()
    setOpen(false)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        acknowledge()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, acknowledge])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="chrome-recommended"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
        >
          <div
            className="absolute inset-0 bg-black/75"
            onClick={acknowledge}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="chrome-recommended-title"
            aria-describedby="chrome-recommended-desc"
            className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 will-change-transform"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease }}
          >
            <div className="flex flex-col gap-5 px-6 pt-7 pb-6">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <RiChromeLine className="size-5" />
              </div>
              <div className="space-y-1.5 text-center">
                <h2
                  id="chrome-recommended-title"
                  className="text-base font-semibold tracking-tight"
                >
                  Best experienced in Chrome
                </h2>
                <p
                  id="chrome-recommended-desc"
                  className="text-sm text-muted-foreground"
                >
                  Tokokino is designed for Chrome. Some features — especially
                  animation export — may not work reliably in Safari or Firefox.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="h-10 w-full text-sm"
                onClick={acknowledge}
              >
                Alright
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
