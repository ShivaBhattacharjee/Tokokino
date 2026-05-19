"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import type { Tilt } from "@/lib/editor/state-types"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  useSelectedScreenshotSlot,
} from "@/lib/editor/store"
import { editorValueSchemas } from "@/lib/editor/value-schemas"

type LivePreviewKind = "canvas" | "slot"

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
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <EditableValue
          value={displayed}
          onChange={(v) => {
            setDraft(null)
            onCommit(v)
          }}
          min={-180}
          max={180}
          suffix="°"
        />
      </div>
      <Slider
        value={[displayed]}
        onValueChange={([v]) => {
          setDraft(v)
          onPreview(v)
        }}
        onValueCommit={([v]) => {
          setDraft(null)
          onCommit(v)
        }}
        min={-45}
        max={45}
        className="cursor-pointer"
      />
    </div>
  )
}

export function TiltSection() {
  const canvasTilt = useActiveCanvasField((c) => c.tilt)
  const canvasScale = useActiveCanvasField((c) => c.scale)
  const selectedSlot = useSelectedScreenshotSlot()
  const activeCanvasId = useActiveCanvasId()
  const tilt = selectedSlot?.tilt ?? canvasTilt
  const scale = selectedSlot?.scale ?? canvasScale
  const setTilt = useEditorStore((s) => s.setTilt)
  const setScale = useEditorStore((s) => s.setScale)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)

  const kind: LivePreviewKind = selectedSlot ? "slot" : "canvas"
  // Resolve the live-preview DOM target on demand so we don't cache a stale
  // node across selection changes or canvas remounts.
  const getTargetEl = React.useCallback((): HTMLElement | null => {
    if (typeof document === "undefined") return null
    if (selectedSlot) {
      return document.querySelector(
        `[data-screenshot-slot-id="${selectedSlot.id}"]`
      )
    }
    if (!activeCanvasId) return null
    return document.querySelector(`[data-canvas-id="${activeCanvasId}"]`)
  }, [selectedSlot, activeCanvasId])

  // If the selection changes mid-drag, clear preview vars from the old target
  // to avoid stale styles bleeding across selections.
  const lastTargetRef = React.useRef<HTMLElement | null>(null)
  const lastKindRef = React.useRef<LivePreviewKind>(kind)
  React.useEffect(() => {
    const prev = lastTargetRef.current
    const prevKind = lastKindRef.current
    if (prev && prevKind) clearPreviewVars(prev, prevKind)
    lastTargetRef.current = getTargetEl()
    lastKindRef.current = kind
    return () => {
      const el = lastTargetRef.current
      const k = lastKindRef.current
      if (el && k) clearPreviewVars(el, k)
    }
  }, [getTargetEl, kind])

  const previewTilt = (next: Tilt) => {
    const el = getTargetEl()
    setPreviewVar(el, kind, "rx", `${next.rx}deg`)
    setPreviewVar(el, kind, "ry", `${next.ry}deg`)
    setPreviewVar(el, kind, "rz", `${next.rz}deg`)
  }
  const previewScale = (next: number) => {
    setPreviewVar(getTargetEl(), kind, "scale", String(next / 100))
  }

  // Defer clearing the CSS var to the next frame so React paints the new
  // transform fallback first — otherwise the transform's CSS transition can
  // animate from the pre-drag value during the gap.
  const clearAfterPaint = (axes: Array<"rx" | "ry" | "rz" | "scale" | "rot">) => {
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => {
      const el = getTargetEl()
      if (!el) return
      for (const axis of axes) setPreviewVar(el, kind, axis, null)
    })
  }

  const commitTilt = (nextTilt: Tilt) => {
    const safeTilt: Tilt = {
      rx: editorValueSchemas.degree.catch(0).parse(nextTilt.rx),
      ry: editorValueSchemas.degree.catch(0).parse(nextTilt.ry),
      rz: editorValueSchemas.degree.catch(0).parse(nextTilt.rz),
    }
    if (selectedSlot) {
      updateScreenshotSlot(selectedSlot.id, { tilt: safeTilt })
    } else {
      setTilt(safeTilt)
    }
    clearAfterPaint(["rx", "ry", "rz"])
  }
  const commitScale = (nextScale: number) => {
    const safeScale = editorValueSchemas.scale.catch(100).parse(nextScale)
    if (selectedSlot) {
      updateScreenshotSlot(selectedSlot.id, { scale: safeScale })
    } else {
      setScale(safeScale)
    }
    clearAfterPaint(["scale"])
  }

  const [scaleDraft, setScaleDraft] = React.useState<number | null>(null)
  const displayedScale = scaleDraft ?? scale

  const rotZ = selectedSlot ? (selectedSlot.rotation) : tilt.rz
  const previewRotZ = (v: number) => {
    if (selectedSlot) setPreviewVar(getTargetEl(), kind, "rot", `${v}deg`)
    else previewTilt({ ...tilt, rz: v })
  }
  const commitRotZ = (v: number) => {
    if (selectedSlot) {
      const safe = editorValueSchemas.degree.catch(0).parse(v)
      updateScreenshotSlot(selectedSlot.id, { rotation: safe })
      clearAfterPaint(["rot"])
    } else {
      commitTilt({ ...tilt, rz: v })
    }
  }

  return (
    <>
      <DegreeRow
        label="Rotate X"
        value={tilt.rx}
        onPreview={(v) => previewTilt({ ...tilt, rx: v })}
        onCommit={(v) => commitTilt({ ...tilt, rx: v })}
      />
      <DegreeRow
        label="Rotate Y"
        value={tilt.ry}
        onPreview={(v) => previewTilt({ ...tilt, ry: v })}
        onCommit={(v) => commitTilt({ ...tilt, ry: v })}
      />
      <DegreeRow
        label="Rotate Z"
        value={rotZ}
        onPreview={previewRotZ}
        onCommit={commitRotZ}
      />
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Scale</span>
        <EditableValue
          value={displayedScale}
          onChange={(v) => {
            setScaleDraft(null)
            commitScale(v)
          }}
          min={10}
          max={300}
          suffix="%"
        />
      </div>
      <Slider
        value={[displayedScale]}
        onValueChange={([v]) => {
          setScaleDraft(v)
          previewScale(v)
        }}
        onValueCommit={([v]) => {
          setScaleDraft(null)
          commitScale(v)
        }}
        min={50}
        max={150}
        className="cursor-pointer"
      />
    </>
  )
}
