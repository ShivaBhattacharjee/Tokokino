"use client"

import * as React from "react"

import { ElasticSlider } from "@/components/elastic-slider"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import type { Tilt } from "@/lib/editor/state-types"
import { useActiveCanvasField, useActiveCanvasId } from "@/lib/editor/store"
import { editorValueSchemas } from "@/lib/editor/value-schemas"

type LivePreviewKind = "canvas" | "slot"
type LivePreviewTarget = { el: HTMLElement; kind: LivePreviewKind }

function setPreviewVar(
  el: HTMLElement | null,
  kind: LivePreviewKind,
  axis: "rx" | "ry" | "rz" | "scale" | "rot",
  value: string | null
) {
  if (!el) return
  const name = `--${kind}-ts-${axis}`
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, value)
}

function clearPreviewVars(el: HTMLElement | null, kind: LivePreviewKind) {
  setPreviewVar(el, kind, "rx", null)
  setPreviewVar(el, kind, "ry", null)
  setPreviewVar(el, kind, "rz", null)
  setPreviewVar(el, kind, "scale", null)
  setPreviewVar(el, kind, "rot", null)
}

function setPreviewVarOnTarget(
  target: LivePreviewTarget,
  axis: "rx" | "ry" | "rz" | "scale" | "rot",
  value: string | null
) {
  setPreviewVar(target.el, target.kind, axis, value)
}

function clearPreviewVarsOnTargets(targets: LivePreviewTarget[]) {
  for (const target of targets) clearPreviewVars(target.el, target.kind)
}

function DegreeRow({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string
  value: number
  onPreview: (v: number) => void
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = React.useState<number | null>(null)
  const displayed = draft ?? value
  return (
    <div className="mb-3">
      <ElasticSlider
        label={label}
        value={displayed}
        onValueChange={(v) => {
          setDraft(v)
          onPreview(v)
        }}
        onValueCommit={(v) => {
          setDraft(null)
          onCommit(v)
        }}
        min={-45}
        max={45}
        step={1}
        formatValue={(v) => `${Math.round(v)}°`}
      />
    </div>
  )
}

export function TiltSection() {
  const canvasTilt = useActiveCanvasField((c) => c.tilt)
  const canvasScale = useActiveCanvasField((c) => c.scale)
  const { applyStyle, selectedSlot, target } = useScreenshotStyleTarget()
  const activeCanvasId = useActiveCanvasId()
  const tilt = selectedSlot?.tilt ?? canvasTilt
  const scale = selectedSlot?.scale ?? canvasScale

  // Resolve the live-preview DOM target on demand so we don't cache a stale
  // node across selection changes or canvas remounts.
  // Tilt is deliberately not fanned out to the preset thumbnails: each one
  // pins the tilt its preset represents. Slot lookups stay scoped inside the
  // canvas so a thumbnail's slot — which carries the same slot id — can't be
  // matched first by a document-wide query.
  const getTargetEls = React.useCallback((): LivePreviewTarget[] => {
    if (typeof document === "undefined" || !activeCanvasId) return []
    const canvasEl = document.querySelector<HTMLElement>(
      `[data-canvas-id="${CSS.escape(activeCanvasId)}"]`
    )
    if (!canvasEl) return []
    if (selectedSlot) {
      const el = canvasEl.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${CSS.escape(selectedSlot.id)}"]`
      )
      return el ? [{ el, kind: "slot" }] : []
    }
    if (target !== "all") return [{ el: canvasEl, kind: "canvas" }]

    const slotTargets = Array.from(
      canvasEl.querySelectorAll<HTMLElement>("[data-screenshot-slot-id]")
    ).map((el) => ({ el, kind: "slot" as const }))
    return [{ el: canvasEl, kind: "canvas" }, ...slotTargets]
  }, [activeCanvasId, selectedSlot, target])

  // If the selection changes mid-drag, clear preview vars from the old target
  // to avoid stale styles bleeding across selections.
  const lastTargetsRef = React.useRef<LivePreviewTarget[]>([])
  React.useEffect(() => {
    clearPreviewVarsOnTargets(lastTargetsRef.current)
    lastTargetsRef.current = getTargetEls()
    return () => {
      clearPreviewVarsOnTargets(lastTargetsRef.current)
    }
  }, [getTargetEls])

  const previewTilt = (next: Tilt) => {
    for (const previewTarget of getTargetEls()) {
      setPreviewVarOnTarget(previewTarget, "rx", `${next.rx}deg`)
      setPreviewVarOnTarget(previewTarget, "ry", `${next.ry}deg`)
      setPreviewVarOnTarget(previewTarget, "rz", `${next.rz}deg`)
    }
  }
  const previewScale = (next: number) => {
    for (const previewTarget of getTargetEls()) {
      setPreviewVarOnTarget(previewTarget, "scale", String(next / 100))
    }
  }

  // Defer clearing the CSS var to the next frame so React paints the new
  // transform fallback first — otherwise the transform's CSS transition can
  // animate from the pre-drag value during the gap.
  const clearAfterPaint = (
    axes: Array<"rx" | "ry" | "rz" | "scale" | "rot">
  ) => {
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => {
      for (const previewTarget of getTargetEls()) {
        for (const axis of axes)
          setPreviewVarOnTarget(previewTarget, axis, null)
      }
    })
  }

  const commitTilt = (nextTilt: Tilt) => {
    const safeTilt: Tilt = {
      rx: editorValueSchemas.degree.catch(0).parse(nextTilt.rx),
      ry: editorValueSchemas.degree.catch(0).parse(nextTilt.ry),
      rz: editorValueSchemas.degree.catch(0).parse(nextTilt.rz),
    }
    applyStyle({ tilt: safeTilt })
    clearAfterPaint(["rx", "ry", "rz"])
  }
  const commitScale = (nextScale: number) => {
    const safeScale = editorValueSchemas.scale.catch(100).parse(nextScale)
    applyStyle({ scale: safeScale })
    clearAfterPaint(["scale"])
  }

  const [scaleDraft, setScaleDraft] = React.useState<number | null>(null)
  const displayedScale = scaleDraft ?? scale

  const rotZ = selectedSlot ? selectedSlot.rotation : tilt.rz
  const previewRotZ = (v: number) => {
    if (selectedSlot) {
      for (const previewTarget of getTargetEls()) {
        setPreviewVarOnTarget(previewTarget, "rot", `${v}deg`)
      }
      return
    }

    for (const previewTarget of getTargetEls()) {
      setPreviewVarOnTarget(
        previewTarget,
        previewTarget.kind === "slot" ? "rot" : "rz",
        `${v}deg`
      )
    }
  }
  const commitRotZ = (v: number) => {
    const safe = editorValueSchemas.degree.catch(0).parse(v)
    applyStyle({ rotation: safe })
    clearAfterPaint(["rx", "ry", "rz", "rot"])
  }

  return (
    <>
      <DegreeRow
        label="Rotate X"
        value={tilt.ry}
        onPreview={(v) => previewTilt({ ...tilt, ry: v })}
        onCommit={(v) => commitTilt({ ...tilt, ry: v })}
      />
      <DegreeRow
        label="Rotate Y"
        value={tilt.rx}
        onPreview={(v) => previewTilt({ ...tilt, rx: v })}
        onCommit={(v) => commitTilt({ ...tilt, rx: v })}
      />
      <DegreeRow
        label="Rotate Z"
        value={rotZ}
        onPreview={previewRotZ}
        onCommit={commitRotZ}
      />
      <ElasticSlider
        label="Scale"
        value={displayedScale}
        onValueChange={(v) => {
          setScaleDraft(v)
          previewScale(v)
        }}
        onValueCommit={(v) => {
          setScaleDraft(null)
          commitScale(v)
        }}
        min={50}
        max={150}
        step={1}
        formatValue={(v) => `${Math.round(v)}%`}
      />
    </>
  )
}
