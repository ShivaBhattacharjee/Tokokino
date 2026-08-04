"use client"

import * as React from "react"
import { RiArrowGoBackLine } from "@remixicon/react"

import {
  BEZIER_Y_MAX,
  BEZIER_Y_MIN,
  cubicBezierEase,
  DEFAULT_CUSTOM_BEZIER,
  normalizeBezier,
  type ClipEasingBezier,
} from "@/lib/editor/clip-easing"
import { cn } from "@/lib/utils"

const VIEW_H = 100
/** Just enough room for the corner endpoint squares — the plot is full-bleed. */
const PAD = 4
/** Compact handles — viewBox units, not CSS px. */
const HANDLE_R = 2.8
const ENDPOINT_R = 2.4
/** Fallback aspect for the first paint, before the box is measured. */
const INITIAL_ASPECT = 1.6

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
  // The viewBox tracks the box aspect, so one uniform scale maps px → units.
  const scale = rect.height / VIEW_H
  const padPx = PAD * scale
  const spanX = rect.width - padPx * 2
  const spanY = rect.height - padPx * 2
  return {
    x: (clientX - rect.left - padPx) / spanX,
    y: 1 - (clientY - rect.top - padPx) / spanY,
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
  const [aspect, setAspect] = React.useState(INITIAL_ASPECT)
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

  React.useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setAspect(rect.width / rect.height)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const viewW = VIEW_H * aspect
  const spanX = viewW - PAD * 2
  const spanY = VIEW_H - PAD * 2
  const toSvg = React.useCallback(
    (x: number, y: number) => ({
      x: PAD + x * spanX,
      y: PAD + (1 - y) * spanY,
    }),
    [spanX, spanY]
  )

  const path = React.useMemo(() => {
    const ease = cubicBezierEase(bezier)
    const samples = 40
    const points: string[] = []
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const point = toSvg(t, ease(t))
      points.push(
        `${i === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      )
    }
    return points.join(" ")
  }, [bezier, toSvg])

  const p0 = toSvg(0, 0)
  const p3 = toSvg(1, 1)
  const p1 = toSvg(bezier.x1, bezier.y1)
  const p2 = toSvg(bezier.x2, bezier.y2)

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

  /** Arrow-key nudge for keyboard users — same normalize + onChange path as drag. */
  const nudgeHandle = React.useCallback(
    (target: DragTarget, dx: number, dy: number) => {
      const base = bezierRef.current
      const next =
        target === "p1"
          ? normalizeBezier({
              ...base,
              x1: base.x1 + dx,
              y1: base.y1 + dy,
            })
          : normalizeBezier({
              ...base,
              x2: base.x2 + dx,
              y2: base.y2 + dy,
            })
      bezierRef.current = next
      onChangeRef.current(next)
    },
    []
  )

  const onP1KeyDown = React.useCallback(
    (e: React.KeyboardEvent<SVGElement>) =>
      handleNudgeKey(e, "p1", nudgeHandle),
    [nudgeHandle]
  )
  const onP2KeyDown = React.useCallback(
    (e: React.KeyboardEvent<SVGElement>) =>
      handleNudgeKey(e, "p2", nudgeHandle),
    [nudgeHandle]
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
        {/* Reset sits over the plot so it stays visible without growing the panel.
            Top-left is the corner the curve and its endpoints never occupy. */}
        {isDefault ? null : (
          <button
            type="button"
            title="Reset curve"
            aria-label="Reset curve to default"
            onClick={resetCurve}
            className="absolute top-1 left-1 z-10 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
          >
            <RiArrowGoBackLine className="size-3" />
          </button>
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewW} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-33 w-full touch-none select-none"
          role="img"
          aria-label="Custom easing curve"
        >
          {gridLines.map((g) => {
            const a = toSvg(g, 0)
            const b = toSvg(g, 1)
            const c = toSvg(0, g)
            const d = toSvg(1, g)
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
            onKeyDown={onP1KeyDown}
            label="First control point"
            valueText={`${bezier.x1.toFixed(2)}, ${bezier.y1.toFixed(2)}`}
          />
          <Handle
            cx={p2.x}
            cy={p2.y}
            r={HANDLE_R}
            onPointerDown={onP2Down}
            onKeyDown={onP2KeyDown}
            label="Second control point"
            valueText={`${bezier.x2.toFixed(2)}, ${bezier.y2.toFixed(2)}`}
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

/** Unit-space step for arrow-key nudges on control points. */
const KEY_NUDGE = 0.02

function handleNudgeKey(
  e: React.KeyboardEvent<SVGElement>,
  target: DragTarget,
  nudge: (target: DragTarget, dx: number, dy: number) => void
) {
  let dx = 0
  let dy = 0
  switch (e.key) {
    case "ArrowLeft":
      dx = -KEY_NUDGE
      break
    case "ArrowRight":
      dx = KEY_NUDGE
      break
    // Unit y is up; SVG y is down — arrows follow the value, not the screen.
    case "ArrowUp":
      dy = KEY_NUDGE
      break
    case "ArrowDown":
      dy = -KEY_NUDGE
      break
    default:
      return
  }
  e.preventDefault()
  e.stopPropagation()
  nudge(target, dx, dy)
}

function Handle({
  cx,
  cy,
  r,
  onPointerDown,
  onKeyDown,
  label,
  valueText,
}: {
  cx: number
  cy: number
  r: number
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void
  onKeyDown: (e: React.KeyboardEvent<SVGElement>) => void
  label: string
  valueText: string
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
        className="cursor-grab outline-none focus-visible:stroke-primary active:cursor-grabbing"
        strokeWidth={1.2}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuetext={valueText}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
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
