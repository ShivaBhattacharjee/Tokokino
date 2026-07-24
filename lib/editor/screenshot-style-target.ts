"use client"

import * as React from "react"

import type { ScreenshotStylePatch } from "./store/canvas-helpers"
import {
  useEditorStore,
  useSelectedScreenshotSlot,
  type ScreenshotSlot,
} from "./store"

export type ScreenshotStyleTarget = "slot" | "main" | "all"

export function useScreenshotStyleTarget() {
  const selectedSlot = useSelectedScreenshotSlot()
  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)
  const applyScreenshotStyle = useEditorStore((s) => s.applyScreenshotStyle)

  const target: ScreenshotStyleTarget = selectedSlot
    ? "slot"
    : isScreenshotSelected
      ? "main"
      : "all"

  // One patch, target resolved from the current selection. Callers no longer
  // hand-pick between the main / all / per-slot setters.
  const applyStyle = React.useCallback(
    (patch: ScreenshotStylePatch) => {
      if (selectedSlot) {
        applyScreenshotStyle({ slotId: selectedSlot.id }, patch)
        return
      }
      applyScreenshotStyle(isScreenshotSelected ? "main" : "all", patch)
    },
    [applyScreenshotStyle, isScreenshotSelected, selectedSlot]
  )

  return { applyStyle, selectedSlot, target }
}

export type { ScreenshotSlot }
