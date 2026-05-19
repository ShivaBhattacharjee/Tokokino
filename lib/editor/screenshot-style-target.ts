"use client"

import * as React from "react"

import {
  useEditorStore,
  useSelectedScreenshotSlot,
  type ScreenshotSlot,
} from "./store"

export type ScreenshotStyleTarget = "slot" | "main" | "all"

export function useScreenshotStyleTarget() {
  const selectedSlot = useSelectedScreenshotSlot()
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)

  const target: ScreenshotStyleTarget = selectedSlot
    ? "slot"
    : isScreenshotSelected
      ? "main"
      : "all"

  const applyStyle = React.useCallback(
    (
      slotPatch: Partial<ScreenshotSlot>,
      applyMain: () => void,
      applyAll: () => void
    ) => {
      if (selectedSlot) {
        updateScreenshotSlot(selectedSlot.id, slotPatch)
        return
      }
      if (isScreenshotSelected) {
        applyMain()
        return
      }
      applyAll()
    },
    [isScreenshotSelected, selectedSlot, updateScreenshotSlot]
  )

  return { applyStyle, selectedSlot, target }
}
