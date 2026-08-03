"use client"

import * as React from "react"
import { RiArrowGoBackLine } from "@remixicon/react"

import {
  BEZIER_Y_MAX,
  BEZIER_Y_MIN,
  cubicBezierEase,
  DEFAULT_CUSTOM_BEZIER,
  easingSvgPathFromFn,
  normalizeBezier,
  unitToSvg,
  type ClipEasingBezier,
} from "@/lib/editor/clip-easing"
import { cn } from "@/lib/utils"

const VIEW = 100
const PAD = 10
/** Compact handles — viewBox units, not CSS px. */
const HANDLE_R = 2.8
const ENDPOINT_R = 2.4

type BezierCurveEditorProps = {
  value: ClipEasingBezier
  onChange: (next: ClipEasingBezier) => void
  className?: string
}

type DragTarget = "p1" | "p2"

function clientToUnit(
  el: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  // Map pointer into viewBox coords (preserveAspectRatio = meet, centered)
  const scale = Math.min(rect.width / VIEW, rect.height / VIEW)
  const ox = rect.left + (rect.width - VIEW * scale) / 2
  const oy = rect.top + (rect.height - VIEW * scale) / 2
  const sx = (clientX - ox) / scale
  const sy = (clientY - oy) / scale
  const span = VIEW - PAD * 2
  return {
    x: (sx - PAD) / span,
    y: 1 - (sy - PAD) / span,
  }
}

function applyHandle(
  target: DragTarget,
  base: ClipEasingBezier,
  el: SVGSVGElement,
  clientX: number,
  clientY: number
): ClipEasingBezier {
  const u = clientToUnit(el, clientX, clientY)
  const x = Math.min(1, Math.max(0, u.x))
  const y = Math.min(BEZIER_Y_MAX, Math.max(BEZIER_Y_MIN, u.y))
  return target === "p1"
    ? normalizeBezier({ ...base, x1: x, y1: y })
    : normalizeBezier({ ...base, x2: x, y2: y })
}

/**
 * Interactive cubic-bezier graph for the Transition popover: fixed endpoints,
 * two small control handles, grid + arms. Fixed height so the popover doesn't
 * grow into a full-width square when Custom is selected.
 */
export function BezierCurveEditor({
  value,
  onChange,
  className,
}: BezierCurveEditorProps) {
  const bezier = normalizeBezier(value)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const dragRef = React.useRef<{
    target: DragTarget
    base: ClipEasingBezier
  } | null>(null)
  const onChangeRef = React.useRef(onChange)
  const bezierRef = React.useRef(bezier)

  React.useLayoutEffect(() => {
    onChangeRef.current = onChange
    bezierRef.current = bezier
  })

  const path = React.useMemo(
    () => easingSvgPathFromFn(cubicBezierEase(bezier), VIEW, PAD, 40),
    [bezier]
  )

  const p0 = unitToSvg(0, 0, VIEW, PAD)
  const p3 = unitToSvg(1, 1, VIEW, PAD)
  const p1 = unitToSvg(bezier.x1, bezier.y1, VIEW, PAD)
  const p2 = unitToSvg(bezier.x2, bezier.y2, VIEW, PAD)

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      const el = svgRef.current
      if (!drag || !el) return
      e.preventDefault()
      const next = applyHandle(drag.target, drag.base, el, e.clientX, e.clientY)
      drag.base = next
      onChangeRef.current(next)
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  const beginDrag = React.useCallback(
    (target: DragTarget, e: React.PointerEvent<SVGElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const el = svgRef.current
      if (!el) return
      const base = bezierRef.current
      const next = applyHandle(target, base, el, e.clientX, e.clientY)
      dragRef.current = { target, base: next }
      onChangeRef.current(next)
    },
    []
  )

  const onP1Down = React.useCallback(
    (e: React.PointerEvent<SVGElement>) => beginDrag("p1", e),
    [beginDrag]
  )
  const onP2Down = React.useCallback(
    (e: React.PointerEvent<SVGElement>) => beginDrag("p2", e),
    [beginDrag]
  )

  const gridLines = [0.25, 0.5, 0.75]

  const isDefault =
    Math.abs(bezier.x1 - DEFAULT_CUSTOM_BEZIER.x1) < 1e-6 &&
    Math.abs(bezier.y1 - DEFAULT_CUSTOM_BEZIER.y1) < 1e-6 &&
    Math.abs(bezier.x2 - DEFAULT_CUSTOM_BEZIER.x2) < 1e-6 &&
    Math.abs(bezier.y2 - DEFAULT_CUSTOM_BEZIER.y2) < 1e-6

  const resetCurve = () => {
    if (isDefault) return
    onChange({ ...DEFAULT_CUSTOM_BEZIER })
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative overflow-hidden rounded-md border border-border/60 bg-muted/25">
        {/* Reset sits over the plot so it stays visible without growing the panel */}
        <button
          type="button"
          title="Reset curve"
          aria-label="Reset curve to default"
          disabled={isDefault}
          onClick={resetCurve}
          className={cn(
            "absolute top-1 right-1 z-10 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-sm transition-colors",
            isDefault
              ? "pointer-events-none opacity-40"
              : "hover:bg-background hover:text-foreground"
          )}
        >
          <RiArrowGoBackLine className="size-3" />
        </button>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-[132px] w-full touch-none select-none"
          role="img"
          aria-label="Custom easing curve"
        >
          <rect
            x={PAD}
            y={PAD}
            width={VIEW - PAD * 2}
            height={VIEW - PAD * 2}
            fill="none"
            className="stroke-border/40"
            strokeWidth={0.5}
          />
          {gridLines.map((g) => {
            const a = unitToSvg(g, 0, VIEW, PAD)
            const b = unitToSvg(g, 1, VIEW, PAD)
            const c = unitToSvg(0, g, VIEW, PAD)
            const d = unitToSvg(1, g, VIEW, PAD)
            return (
              <g key={g}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-border/25"
                  strokeWidth={0.4}
                />
                <line
                  x1={c.x}
                  y1={c.y}
                  x2={d.x}
                  y2={d.y}
                  className="stroke-border/25"
                  strokeWidth={0.4}
                />
              </g>
            )
          })}

          <line
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            className="stroke-foreground/30"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <line
            x1={p3.x}
            y1={p3.y}
            x2={p2.x}
            y2={p2.y}
            className="stroke-foreground/30"
            strokeWidth={1}
            strokeLinecap="round"
          />

          <path
            d={path}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-foreground/80"
          />

          <rect
            x={p0.x - ENDPOINT_R}
            y={p0.y - ENDPOINT_R}
            width={ENDPOINT_R * 2}
            height={ENDPOINT_R * 2}
            rx={0.6}
            className="fill-background stroke-foreground"
            strokeWidth={1}
          />
          <rect
            x={p3.x - ENDPOINT_R}
            y={p3.y - ENDPOINT_R}
            width={ENDPOINT_R * 2}
            height={ENDPOINT_R * 2}
            rx={0.6}
            className="fill-background stroke-foreground"
            strokeWidth={1}
          />

          <Handle
            cx={p1.x}
            cy={p1.y}
            r={HANDLE_R}
            onPointerDown={onP1Down}
            label="First control point"
          />
          <Handle
            cx={p2.x}
            cy={p2.y}
            r={HANDLE_R}
            onPointerDown={onP2Down}
            label="Second control point"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5 font-mono text-[9px] text-muted-foreground tabular-nums">
        <span>
          ({bezier.x1.toFixed(2)}, {bezier.y1.toFixed(2)})
        </span>
        <span>
          ({bezier.x2.toFixed(2)}, {bezier.y2.toFixed(2)})
        </span>
      </div>
    </div>
  )
}

function Handle({
  cx,
  cy,
  r,
  onPointerDown,
  label,
}: {
  cx: number
  cy: number
  r: number
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void
  label: string
}) {
  // Invisible hit area slightly larger than the drawn square for easier grab.
  const hit = r + 2.5
  return (
    <g>
      <rect
        x={cx - hit}
        y={cy - hit}
        width={hit * 2}
        height={hit * 2}
        fill="transparent"
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
      />
      <rect
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        rx={0.7}
        className="pointer-events-none fill-background stroke-foreground"
        strokeWidth={1.1}
      />
      <title>{label}</title>
    </g>
  )
}
