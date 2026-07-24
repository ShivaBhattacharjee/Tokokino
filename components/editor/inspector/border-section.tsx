"use client"

import * as React from "react"

import { ElasticSlider } from "@/components/elastic-slider"
import { sampleImageColorsRaw, useActiveCanvasField } from "@/lib/editor/store"
import type { Border } from "@/lib/editor/state-types"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import { cn } from "@/lib/utils"

import { ColorPresetGrid, SubHeader } from "./primitives"

const BORDER_PRESETS = [
  "#f08a9a", // strawberry
  "#fde2e4", // strawberry blush
  "#92b97a", // matcha
  "#cfe5b8", // matcha mist
  "#0f172a", // ink
  "#ffffff", // white
]

const DEFAULT_BORDER_COLOR = BORDER_PRESETS[0]

type FramePreset = {
  id: string
  label: string
  // null color = no frame; otherwise the border fields this preset applies
  frame: { color: string; width: number; padding: number } | null
}

// Curated frame looks — each just sets the existing border color/width/padding
// (rendered as a rounded `outline` around the screenshot). "Glass" variants use
// a translucent tint so the background shows through; "Mat" variants are solid.
const FRAME_PRESETS: FramePreset[] = [
  { id: "none", label: "None", frame: null },
  {
    id: "frost",
    label: "Frost",
    frame: { color: "rgba(255,255,255,0.5)", width: 8, padding: 3 },
  },
  {
    id: "frost-dark",
    label: "Frost Dark",
    frame: { color: "rgba(15,15,20,0.55)", width: 8, padding: 3 },
  },
  {
    id: "hairline",
    label: "Hairline",
    frame: { color: "rgba(255,255,255,0.75)", width: 2, padding: 6 },
  },
  {
    id: "mat",
    label: "Mat",
    frame: { color: "#ffffff", width: 10, padding: 0 },
  },
  {
    id: "mat-dark",
    label: "Mat Dark",
    frame: { color: "#0f172a", width: 10, padding: 0 },
  },
]

function framePresetMatches(preset: FramePreset, border: Border): boolean {
  if (!preset.frame) return border.color === null
  return (
    border.color?.toLowerCase() === preset.frame.color.toLowerCase() &&
    border.width === preset.frame.width &&
    border.padding === preset.frame.padding
  )
}

function FrameThumb({ preset }: { preset: FramePreset }) {
  const inner = (
    <div className="size-full rounded-[3px] bg-neutral-200 dark:bg-neutral-300" />
  )
  if (!preset.frame) {
    return (
      <div className="size-full rounded-sm p-2">
        <div className="size-full rounded-[3px] border-[3px] border-solid border-black/40 dark:border-white/40" />
      </div>
    )
  }
  const thickness = Math.max(2, Math.round(preset.frame.width * 0.55))
  return (
    <div className="size-full rounded-sm p-1.5">
      <div
        className="grid size-full place-items-center rounded-[5px]"
        style={{ background: preset.frame.color, padding: thickness }}
      >
        {inner}
      </div>
    </div>
  )
}

export function BorderSection() {
  const canvasBorder = useActiveCanvasField((c) => c.border)
  const canvasBorderRadius = useActiveCanvasField((c) => c.borderRadius)
  const { applyStyle, selectedSlot } = useScreenshotStyleTarget()
  const border = selectedSlot?.border ?? canvasBorder
  const borderRadius = selectedSlot?.borderRadius ?? canvasBorderRadius
  const background = useActiveCanvasField((c) => c.background)
  const canvasScreenshot = useActiveCanvasField((c) => c.screenshot)
  const screenshot = selectedSlot?.src ?? canvasScreenshot
  const applyBorder = (nextBorder: typeof border) => {
    applyStyle({ border: nextBorder })
  }
  const applyBorderRadius = (nextRadius: number) => {
    applyStyle({ borderRadius: nextRadius })
  }
  const enabled = border.color !== null
  const currentColor = border.color || DEFAULT_BORDER_COLOR

  const [dynamicColors, setDynamicColors] = React.useState<string[]>([])

  React.useEffect(() => {
    let active = true
    async function loadColors() {
      let url = null
      if (background.type === "image") {
        url = background.thumbUrl ?? background.value
      } else if (screenshot) {
        url = screenshot
      }

      if (url) {
        try {
          const colors = await sampleImageColorsRaw(url, 4)
          if (active) setDynamicColors(colors)
        } catch {
          if (active) setDynamicColors([])
        }
      } else if (
        background.type === "gradient" ||
        background.type === "solid"
      ) {
        const matches = background.value.match(/#[0-9a-fA-F]{3,8}/g) ?? []
        if (active) setDynamicColors(matches.slice(0, 4))
      } else {
        if (active) setDynamicColors([])
      }
    }
    void loadColors()
    return () => {
      active = false
    }
  }, [background.thumbUrl, background.type, background.value, screenshot])

  const presets =
    dynamicColors.length > 0
      ? [
          ...new Set(
            ["#ffffff", "#0f172a", ...dynamicColors].map((c) => c.toLowerCase())
          ),
        ]
      : [...BORDER_PRESETS]

  while (presets.length < 6) {
    presets.push(BORDER_PRESETS[presets.length])
  }
  const finalPresets = presets.slice(0, 6)

  const isCustom =
    enabled &&
    !finalPresets.some((c) => c.toLowerCase() === currentColor.toLowerCase())

  const activePreset = enabled
    ? (FRAME_PRESETS.find((p) => framePresetMatches(p, border))?.id ?? null)
    : "none"

  return (
    <div className="space-y-4">
      <ElasticSlider
        label="Radius"
        value={borderRadius}
        onValueChange={applyBorderRadius}
        min={0}
        max={48}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
      />

      <div className="h-px bg-border/40" />

      <ElasticSlider
        label="Width"
        value={border.width}
        onValueChange={(v) => applyBorder({ ...border, width: v })}
        min={0}
        max={12}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
      />

      <ElasticSlider
        label="Inner Padding"
        value={border.padding}
        onValueChange={(v) => applyBorder({ ...border, padding: v })}
        min={0}
        max={80}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
      />

      <div>
        <SubHeader>Style</SubHeader>
        <div className="mb-4 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
          {FRAME_PRESETS.map((preset) => {
            const active = preset.id === activePreset
            return (
              <button
                key={preset.id}
                onClick={() => {
                  if (!preset.frame) {
                    applyBorder({ ...border, color: null })
                    return
                  }
                  applyBorder({
                    ...border,
                    style: "solid",
                    color: preset.frame.color,
                    width: preset.frame.width,
                    padding: preset.frame.padding,
                  })
                }}
                className={cn(
                  "flex w-[92px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border p-1.5 transition-all md:w-auto md:gap-1.5 md:rounded-lg",
                  active
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/60 bg-secondary/20 hover:border-foreground/30"
                )}
              >
                <div className="h-14 w-full md:aspect-square md:h-auto">
                  <FrameThumb preset={preset} />
                </div>
                <span
                  className={cn(
                    "text-[9px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
        <SubHeader>Color</SubHeader>
        <ColorPresetGrid
          presets={finalPresets}
          selected={enabled ? currentColor : null}
          onSelect={(c) => applyBorder({ ...border, color: c })}
          customColor={isCustom ? currentColor : DEFAULT_BORDER_COLOR}
          onCustomColor={(hex) => applyBorder({ ...border, color: hex })}
          isCustom={isCustom}
          customLabel="Custom border color"
          tileShape="rect"
        />
      </div>
    </div>
  )
}
