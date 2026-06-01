"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import {
  sampleImageColorsRaw,
  useActiveCanvasField,
  useEditorStore,
} from "@/lib/editor/store"
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

export function BorderSection() {
  const canvasBorder = useActiveCanvasField((c) => c.border)
  const canvasBorderRadius = useActiveCanvasField((c) => c.borderRadius)
  const { applyStyle, selectedSlot } = useScreenshotStyleTarget()
  const border = selectedSlot?.border ?? canvasBorder
  const borderRadius = selectedSlot?.borderRadius ?? canvasBorderRadius
  const background = useActiveCanvasField((c) => c.background)
  const canvasScreenshot = useActiveCanvasField((c) => c.screenshot)
  const screenshot = selectedSlot?.src ?? canvasScreenshot
  const setBorder = useEditorStore((s) => s.setBorder)
  const setBorderRadius = useEditorStore((s) => s.setBorderRadius)
  const setMainScreenshotBorder = useEditorStore(
    (s) => s.setMainScreenshotBorder
  )
  const setMainScreenshotBorderRadius = useEditorStore(
    (s) => s.setMainScreenshotBorderRadius
  )
  const applyBorder = (nextBorder: typeof border) => {
    applyStyle(
      { border: nextBorder },
      () => setMainScreenshotBorder(nextBorder),
      () => setBorder(nextBorder)
    )
  }
  const applyBorderRadius = (nextRadius: number) => {
    applyStyle(
      { borderRadius: nextRadius },
      () => setMainScreenshotBorderRadius(nextRadius),
      () => setBorderRadius(nextRadius)
    )
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

  const thumbBg = "bg-transparent"

  const borderStyles = [
    {
      id: "none" as const,
      label: "None",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-solid border-black/45 dark:border-white/45" />
        </div>
      ),
    },
    {
      id: "solid" as const,
      label: "Solid",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-solid border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "dashed" as const,
      label: "Dashed",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-dashed border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "dotted" as const,
      label: "Dotted",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-dotted border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "double" as const,
      label: "Double",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[4px] border-double border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "groove" as const,
      label: "Groove",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="border-groove size-full rounded-[3px] border-[3px] border-black dark:border-white" />
        </div>
      ),
    },
    {
      id: "ridge" as const,
      label: "Ridge",
      icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="border-ridge size-full rounded-[3px] border-[3px] border-black dark:border-white" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Radius</span>
          <EditableValue
            value={borderRadius}
            onChange={applyBorderRadius}
            min={0}
            max={48}
            suffix="px"
          />
        </div>
        <Slider
          value={[borderRadius]}
          onValueChange={([v]) => applyBorderRadius(v)}
          max={48}
          className="cursor-pointer"
        />
      </div>

      <div className="h-px bg-border/40" />

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Width</span>
          <EditableValue
            value={border.width}
            onChange={(v) => applyBorder({ ...border, width: v })}
            min={0}
            max={12}
            suffix="px"
          />
        </div>
        <Slider
          value={[border.width]}
          onValueChange={([v]) => applyBorder({ ...border, width: v })}
          min={0}
          max={12}
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">
            Inner Padding
          </span>
          <EditableValue
            value={border.padding}
            onChange={(v) => applyBorder({ ...border, padding: v })}
            min={0}
            max={80}
            suffix="px"
          />
        </div>
        <Slider
          value={[border.padding]}
          onValueChange={([v]) => applyBorder({ ...border, padding: v })}
          min={0}
          max={80}
          className="cursor-pointer"
        />
      </div>

      <div>
        <SubHeader>Style</SubHeader>
        <div className="mb-4 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
          {borderStyles.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "none") {
                  applyBorder({ ...border, color: null })
                  return
                }
                const patch: Partial<typeof border> = { style: t.id }
                if (!border.color) patch.color = DEFAULT_BORDER_COLOR
                applyBorder({ ...border, ...patch })
              }}
              className={cn(
                "flex w-[92px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border p-1.5 transition-all md:w-auto md:gap-1.5 md:rounded-lg",
                (
                  t.id === "none"
                    ? !enabled
                    : enabled && (border.style || "solid") === t.id
                )
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
                  (
                    t.id === "none"
                      ? !enabled
                      : enabled && (border.style || "solid") === t.id
                  )
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            </button>
          ))}
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
