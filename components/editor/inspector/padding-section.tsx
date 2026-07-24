"use client"

import * as React from "react"

import { ElasticSlider } from "@/components/elastic-slider"
import { useActiveCanvasField, useActiveCanvasId } from "@/lib/editor/store"
import {
  livePreviewRoots,
  setLivePreviewVar,
} from "@/lib/editor/live-preview-vars"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import { cn } from "@/lib/utils"

const PADDING_PREVIEW_VAR = "--editor-padding-preview"

export function PaddingSection() {
  const canvasPadding = useActiveCanvasField((c) => c.padding)
  const activeCanvasId = useActiveCanvasId()
  const { applyStyle, selectedSlot, target } = useScreenshotStyleTarget()
  const padding = selectedSlot?.padding ?? canvasPadding
  const [draftPadding, setDraftPadding] = React.useState<number | null>(null)
  const displayedPadding = draftPadding ?? padding
  const getPreviewScopeEls = React.useCallback((): HTMLElement[] => {
    const roots = livePreviewRoots(activeCanvasId)
    if (target === "all") return roots

    const scopeId = target === "slot" ? selectedSlot?.id : "canvas"
    if (!scopeId) return roots
    return roots.map(
      (root) =>
        root.querySelector<HTMLElement>(
          `[data-editor-shadow-preview-scope="${CSS.escape(scopeId)}"]`
        ) ?? root
    )
  }, [activeCanvasId, selectedSlot?.id, target])
  const setPreviewPadding = React.useCallback(
    (value: number | null) => {
      setLivePreviewVar(
        getPreviewScopeEls(),
        PADDING_PREVIEW_VAR,
        value === null ? null : `${Math.max(0, Math.min(240, value)) / 12}%`
      )
    },
    [getPreviewScopeEls]
  )
  const clearPreviewPaddingAfterPaint = React.useCallback(() => {
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => setPreviewPadding(null))
  }, [setPreviewPadding])
  const applyPadding = React.useCallback(
    (value: number) => {
      applyStyle({ padding: value })
      setDraftPadding(null)
      clearPreviewPaddingAfterPaint()
    },
    [applyStyle, clearPreviewPaddingAfterPaint]
  )
  const previewPadding = React.useCallback(
    (value: number) => {
      setDraftPadding(value)
      setPreviewPadding(value)
    },
    [setPreviewPadding]
  )
  const quick = [16, 40, 80, 120]
  return (
    <>
      <ElasticSlider
        label="Inset"
        value={displayedPadding}
        onValueChange={previewPadding}
        onValueCommit={applyPadding}
        min={0}
        max={240}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
        className="mb-3"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => applyPadding(q)}
            className={cn(
              "tabular h-8 cursor-pointer rounded-md border font-mono text-[11px] transition-colors",
              displayedPadding === q
                ? "border-primary/30 bg-primary text-white"
                : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-foreground/25"
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </>
  )
}
