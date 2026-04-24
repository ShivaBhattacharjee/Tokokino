"use client"

import * as React from "react"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? "moon" : "sun"}
              initial={{ rotate: -60, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 60, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="inline-flex"
            >
              {isDark ? <RiMoonLine /> : <RiSunLine />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="tabular">
        Theme · press <kbd className="font-mono">d</kbd>
      </TooltipContent>
    </Tooltip>
  )
}
