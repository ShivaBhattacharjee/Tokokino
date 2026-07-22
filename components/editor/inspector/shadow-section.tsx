"use client"

import * as React from "react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { EffectSlider } from "@/components/editor/inspector/effect-slider"
import {
  livePreviewRoots,
  setLivePreviewVar,
} from "@/lib/editor/live-preview-vars"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
} from "@/lib/editor/store"
import {
  SHADOW_FILTER_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
  shadowCss,
  shadowDropFilterCss,
} from "@/lib/editor/css-utils"
import { cn } from "@/lib/utils"

const SHADOW_COLOR_PRESETS = [
  "#050505",
  "#2b3346",
  "#7b6a86",
  "#a66c5f",
  "#5f897a",
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

type LightPoint = { row: number; col: number }

function lightSourceToPoint(lightSource: string): LightPoint {
  if (lightSource === "center") return { row: 2, col: 2 }

  const [row, col] = lightSource.split("-").map(Number)
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return { row: 2, col: 2 }
  }

  return {
    row: clamp(row, 0, 4),
    col: clamp(col, 0, 4),
  }
}

function pointToLightSource(row: number, col: number) {
  const safeRow = clamp(row, 0, 4)
  const safeCol = clamp(col, 0, 4)
  const isCenter = Math.abs(safeRow - 2) < 0.01 && Math.abs(safeCol - 2) < 0.01
  return isCenter ? "center" : `${safeRow.toFixed(2)}-${safeCol.toFixed(2)}`
}

function DirectionField({
  color,
  disabled,
  lightSource,
  onChange,
  onPreview,
}: {
  color: string
  disabled: boolean
  lightSource: string
  onChange: (id: string) => void
  onPreview: (id: string) => void
}) {
  const sourcePoint = lightSourceToPoint(lightSource)
  const orbRef = React.useRef<HTMLDivElement | null>(null)
  const glowRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef(false)
  const draftPointRef = React.useRef(sourcePoint)
  const committedLightSourceRef = React.useRef(lightSource)
  const x = (sourcePoint.col / 4) * 100
  const y = (sourcePoint.row / 4) * 100
  const glowOpacity = disabled ? 0.25 : 0.75
  const glowBackground = `radial-gradient(circle, ${color}70 0%, transparent 70%)`

  const moveVisualPoint = React.useCallback(
    (nextPoint: LightPoint) => {
      draftPointRef.current = nextPoint
      const nextX = (nextPoint.col / 4) * 100
      const nextY = (nextPoint.row / 4) * 100

      if (orbRef.current) {
        orbRef.current.style.cssText = `left: calc(${nextX}% - 14px); top: calc(${nextY}% - 14px);`
      }

      if (glowRef.current) {
        glowRef.current.style.cssText = `left: calc(${nextX}% - 48px); top: calc(${nextY}% - 48px); background: ${glowBackground}; opacity: ${glowOpacity};`
      }
    },
    [glowBackground, glowOpacity]
  )

  React.useLayoutEffect(() => {
    if (draggingRef.current) return
    moveVisualPoint(sourcePoint)
  }, [moveVisualPoint, sourcePoint])

  const pointFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const nextX = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      const nextY = clamp((event.clientY - rect.top) / rect.height, 0, 1)
      return {
        col: nextX * 4,
        row: nextY * 4,
      }
    },
    []
  )

  const pointId = React.useCallback(
    (nextPoint: LightPoint) => pointToLightSource(nextPoint.row, nextPoint.col),
    []
  )
  const previewPoint = React.useCallback(
    (nextPoint: LightPoint) => {
      const nextLightSource = pointId(nextPoint)
      onPreview(nextLightSource)
    },
    [onPreview, pointId]
  )
  const commitPoint = React.useCallback(
    (nextPoint: LightPoint) => {
      const nextLightSource = pointId(nextPoint)
      if (nextLightSource === committedLightSourceRef.current) return

      committedLightSourceRef.current = nextLightSource
      onChange(nextLightSource)
    },
    [onChange, pointId]
  )

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return

      event.currentTarget.setPointerCapture(event.pointerId)
      committedLightSourceRef.current = lightSource
      draggingRef.current = true
      const nextPoint = pointFromPointer(event)
      moveVisualPoint(nextPoint)
      previewPoint(nextPoint)
    },
    [disabled, lightSource, moveVisualPoint, pointFromPointer, previewPoint]
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !draggingRef.current || event.buttons !== 1) return
      const nextPoint = pointFromPointer(event)
      moveVisualPoint(nextPoint)
      previewPoint(nextPoint)
    },
    [disabled, moveVisualPoint, pointFromPointer, previewPoint]
  )

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !draggingRef.current) return

      const nextPoint = pointFromPointer(event)
      moveVisualPoint(nextPoint)
      draggingRef.current = false
      commitPoint(nextPoint)
    },
    [commitPoint, disabled, moveVisualPoint, pointFromPointer]
  )

  const handlePointerCancel = React.useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    commitPoint(draftPointRef.current)
  }, [commitPoint])

  const handleLostPointerCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || event.buttons === 1) return
      draggingRef.current = false
      commitPoint(draftPointRef.current)
    },
    [commitPoint]
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return

      let { row, col } = sourcePoint
      if (event.key === "ArrowLeft") col -= 0.25
      else if (event.key === "ArrowRight") col += 0.25
      else if (event.key === "ArrowUp") row -= 0.25
      else if (event.key === "ArrowDown") row += 0.25
      else if (event.key === "Home") {
        row = 2
        col = 2
      } else {
        return
      }

      event.preventDefault()
      onChange(pointToLightSource(row, col))
    },
    [disabled, sourcePoint, onChange]
  )

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Shadow light direction"
      aria-valuenow={Math.round((x + y) / 2)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(x)}% horizontal, ${Math.round(y)}% vertical`}
      aria-disabled={disabled}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      className={cn(
        "group relative h-[132px] w-full max-w-full touch-none overflow-hidden rounded-md border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_rgba(44,36,25,0.06)] transition outline-none dark:border-white/10 dark:bg-[#202020] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        disabled
          ? "cursor-not-allowed opacity-55"
          : "cursor-grab focus-visible:ring-2 focus-visible:ring-[#f65d72]/50 active:cursor-grabbing"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1.5px)] bg-[length:14px_14px] text-black/25 dark:text-white/15" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.38),rgba(136,180,143,0.06)_48%,rgba(255,90,114,0.05))] dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_54%)]" />
      <div
        ref={glowRef}
        className="pointer-events-none absolute size-24 rounded-full blur-2xl will-change-[left,top]"
        style={{
          left: `calc(${x}% - 48px)`,
          top: `calc(${y}% - 48px)`,
          background: glowBackground,
          opacity: glowOpacity,
        }}
      />
      <div
        ref={orbRef}
        className="absolute z-10 size-7 rounded-full border-[3px] border-white bg-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_10px_24px_rgba(0,0,0,0.35)] transition-transform will-change-[left,top] group-active:scale-105"
        style={{ left: `calc(${x}% - 14px)`, top: `calc(${y}% - 14px)` }}
      >
        <span
          className="absolute inset-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ColorRail({
  color,
  isCustomColor,
  onChange,
}: {
  color: string
  isCustomColor: boolean
  onChange: (color: string) => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 xl:gap-2.5">
      {SHADOW_COLOR_PRESETS.map((preset) => {
        const active =
          !isCustomColor && color.toLowerCase() === preset.toLowerCase()
        return (
          <button
            key={preset}
            type="button"
            aria-label={`Use ${preset} shadow`}
            onClick={() => onChange(preset)}
            className={cn(
              "size-6 rounded-md border border-white/10 transition hover:scale-105 xl:size-7",
              active
                ? "ring-2 ring-[#f65d72] ring-offset-2 ring-offset-[#f7f2ea] dark:ring-offset-[#151515]"
                : "ring-1 ring-black/30"
            )}
            style={{ backgroundColor: preset }}
          />
        )
      })}
      <ColorPickerPopover
        value={isCustomColor ? color : "#000000"}
        onChange={onChange}
        side="left"
        align="center"
      >
        <button
          type="button"
          aria-label="Choose custom shadow color"
          className={cn(
            "relative size-7 rounded-md border border-white/15 transition hover:scale-105 xl:size-8",
            isCustomColor
              ? "ring-2 ring-[#f65d72] ring-offset-2 ring-offset-[#f7f2ea] dark:ring-offset-[#151515]"
              : "ring-1 ring-black/30"
          )}
          style={{
            background: isCustomColor
              ? color
              : "conic-gradient(from 180deg, #f87171, #f59e0b, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)",
          }}
        >
          <span className="absolute inset-2 rounded-sm border border-white/80" />
        </button>
      </ColorPickerPopover>
    </div>
  )
}

export function ShadowSection() {
  const canvasShadow = useActiveCanvasField((c) => c.shadow)
  const activeCanvasId = useActiveCanvasId()
  const { applyStyle, selectedSlot, target } = useScreenshotStyleTarget()
  const setShadow = useEditorStore((s) => s.setShadow)
  const setMainScreenshotShadow = useEditorStore(
    (s) => s.setMainScreenshotShadow
  )

  const shadow = selectedSlot
    ? (selectedSlot.shadow ?? canvasShadow)
    : canvasShadow

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

  const setPreviewVar = React.useCallback(
    (name: string, value: string | null) => {
      setLivePreviewVar(getPreviewScopeEls(), name, value)
    },
    [getPreviewScopeEls]
  )

  const clearPreviewVarsAfterPaint = React.useCallback(() => {
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => {
      setPreviewVar(SHADOW_PREVIEW_VAR, null)
      setPreviewVar(SHADOW_FILTER_PREVIEW_VAR, null)
    })
  }, [setPreviewVar])

  const previewShadow = React.useCallback(
    (nextShadow: typeof canvasShadow) => {
      setPreviewVar(SHADOW_PREVIEW_VAR, shadowCss(nextShadow) ?? null)
      setPreviewVar(
        SHADOW_FILTER_PREVIEW_VAR,
        shadowDropFilterCss(nextShadow) ?? null
      )
    },
    [setPreviewVar]
  )

  const applyShadow = React.useCallback(
    (nextShadow: typeof canvasShadow) => {
      applyStyle(
        { shadow: nextShadow },
        () => setMainScreenshotShadow(nextShadow),
        () => setShadow(nextShadow)
      )
      clearPreviewVarsAfterPaint()
    },
    [applyStyle, clearPreviewVarsAfterPaint, setMainScreenshotShadow, setShadow]
  )
  const { type, intensity, lightSource, color = "#050505" } = shadow

  const enabled = type !== "none"
  const directionalDisabled = !enabled || type === "glow" || type === "float"
  const isCustomColor = !SHADOW_COLOR_PRESETS.some(
    (preset) => preset.toLowerCase() === color.toLowerCase()
  )

  const setType = (nextType: typeof shadow.type) => {
    if (nextType === "hard") {
      applyShadow({
        ...shadow,
        type: nextType,
        intensity: 100,
        lightSource: "2-0",
      })
      return
    }
    applyShadow({ ...shadow, type: nextType })
  }
  const previewIntensity = (n: number) =>
    previewShadow({ ...shadow, intensity: n })
  const setIntensity = (n: number) => applyShadow({ ...shadow, intensity: n })
  const previewLightSource = (id: string) =>
    previewShadow({ ...shadow, lightSource: id })
  const setLightSource = (id: string) =>
    applyShadow({ ...shadow, lightSource: id })
  const setColor = (c: string) => applyShadow({ ...shadow, color: c })

  const thumbBg = "bg-transparent"
  const thumbCard = "rounded-[3px] bg-black dark:bg-white"

  const types = [
    {
      id: "none" as const,
      label: "None",
      icon: (
        <div className={cn("size-full rounded-sm p-3", thumbBg)}>
          <div className="size-full rounded-[3px] border-2 border-dashed border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "drop" as const,
      label: "Drop",
      icon: (
        <div className={cn("size-full rounded-sm p-3 pr-4 pb-4", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[5px_5px_8px_0px_rgba(0,0,0,0.45)] dark:shadow-[5px_5px_8px_0px_rgba(255,255,255,0.45)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
    {
      id: "soft" as const,
      label: "Soft",
      icon: (
        <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[0_8px_20px_2px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_20px_2px_rgba(255,255,255,0.3)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
    {
      id: "hard" as const,
      label: "Hard",
      icon: (
        <div className={cn("size-full rounded-sm p-3 pr-4 pb-4", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[5px_5px_0px_0px_rgba(0,0,0,0.75)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.75)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
    {
      id: "glow" as const,
      label: "Glow",
      icon: (
        <div className={cn("size-full rounded-sm p-3", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[0_0_14px_3px_rgba(0,0,0,0.35)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
    {
      id: "float" as const,
      label: "Float",
      icon: (
        <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[0_4px_6px_0px_rgba(0,0,0,0.25),0_12px_20px_0px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_6px_0px_rgba(255,255,255,0.25),0_12px_20px_0px_rgba(255,255,255,0.2)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
    {
      id: "linear" as const,
      label: "Linear",
      icon: (
        <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
          <div
            className={cn(
              "size-full shadow-[0_4px_8px_rgba(0,0,0,0.1),_0_10px_20px_rgba(0,0,0,0.08),_0_20px_40px_rgba(0,0,0,0.05),_0_30px_60px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_8px_rgba(255,255,255,0.1),_0_10px_20px_rgba(255,255,255,0.08),_0_20px_40px_rgba(255,255,255,0.05),_0_30px_60px_rgba(255,255,255,0.02)]",
              thumbCard
            )}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={cn(
              "flex w-[92px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border p-1.5 transition-all md:w-auto md:gap-1.5",
              type === t.id
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div className="h-14 w-full md:aspect-square md:h-auto">
              {t.icon}
            </div>
            <span
              className={cn(
                "text-[9px] font-medium",
                type === t.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div
        className={cn(
          "min-w-0 rounded-md border border-black/10 bg-white p-3 shadow-[0_14px_30px_rgba(44,36,25,0.08)] dark:border-white/8 dark:bg-[#151515] dark:shadow-none",
          !enabled && "opacity-55"
        )}
      >
        <div className="mb-3 min-w-0">
          <span className="mb-3 block text-[11px] font-medium text-black/50 dark:text-white/55">
            Color
          </span>
          <ColorRail
            color={color}
            isCustomColor={isCustomColor}
            onChange={setColor}
          />
        </div>

        <EffectSlider
          label="Intensity"
          value={intensity}
          onPreview={previewIntensity}
          onChange={setIntensity}
          max={100}
          disabled={!enabled}
          sliderClassName="cursor-pointer [&_[data-slot=slider-range]]:bg-[#f65d72] [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-thumb]]:border-[#f65d72] [&_[data-slot=slider-track]]:bg-black/10 dark:[&_[data-slot=slider-track]]:bg-white/10"
        />
      </div>

      <div className={cn(directionalDisabled && "pointer-events-none")}>
        <DirectionField
          color={color}
          disabled={directionalDisabled}
          lightSource={lightSource}
          onPreview={previewLightSource}
          onChange={setLightSource}
        />
      </div>
    </div>
  )
}
