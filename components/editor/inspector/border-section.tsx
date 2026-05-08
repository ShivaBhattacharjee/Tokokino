"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { sampleImageColorsRaw, useEditor } from "@/lib/editor/store"
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
  const { border, setBorder, borderRadius, setBorderRadius, background, screenshot } = useEditor()
  const enabled = border.color !== null
  const currentColor = border.color || DEFAULT_BORDER_COLOR

  const [dynamicColors, setDynamicColors] = React.useState<string[]>([])

  React.useEffect(() => {
    let active = true
    async function loadColors() {
      let url = null
      if (background.type === "image") {
        url = background.value
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
      } else if (background.type === "gradient" || background.type === "solid") {
        const matches = background.value.match(/#[0-9a-fA-F]{3,8}/g) ?? []
        if (active) setDynamicColors(matches.slice(0, 4))
      } else {
        if (active) setDynamicColors([])
      }
    }
    loadColors()
    return () => {
      active = false
    }
  }, [background, screenshot])

  const presets = dynamicColors.length > 0
    ? ["#ffffff", "#0f172a", ...dynamicColors]
    : [...BORDER_PRESETS]

  while (presets.length < 6) {
    presets.push(BORDER_PRESETS[presets.length])
  }
  const finalPresets = presets.slice(0, 6)

  const isCustom =
    enabled &&
    !finalPresets.some((c) => c.toLowerCase() === currentColor.toLowerCase())

  const thumbBg = "bg-[#d1d5db]"

  const borderStyles = [
    {
      id: "solid" as const, label: "Solid", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-solid border-gray-500" />
        </div>
      )
    },
    {
      id: "dashed" as const, label: "Dashed", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-dashed border-gray-500" />
        </div>
      )
    },
    {
      id: "dotted" as const, label: "Dotted", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-dotted border-gray-500" />
        </div>
      )
    },
    {
      id: "double" as const, label: "Double", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[4px] border-double border-gray-500" />
        </div>
      )
    },
    {
      id: "groove" as const, label: "Groove", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-groove border-gray-500" />
        </div>
      )
    },
    {
      id: "ridge" as const, label: "Ridge", icon: (
        <div className={cn("size-full rounded-sm p-2", thumbBg)}>
          <div className="size-full rounded-[3px] border-[3px] border-ridge border-gray-500" />
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Radius</span>
          <EditableValue
            value={borderRadius}
            onChange={setBorderRadius}
            min={0}
            max={48}
            suffix="px"
          />
        </div>
        <Slider
          value={[borderRadius]}
          onValueChange={([v]) => setBorderRadius(v)}
          max={48}
          className="cursor-pointer"
        />
      </div>

      <div className="h-px bg-border/40" />

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Border</span>
        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={(on) =>
            setBorder({ ...border, color: on ? DEFAULT_BORDER_COLOR : null })
          }
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Width</span>
          <EditableValue
            value={border.width}
            onChange={(v) => setBorder({ ...border, width: v })}
            min={0}
            max={12}
            suffix="px"
          />
        </div>
        <Slider
          value={[border.width]}
          onValueChange={([v]) => setBorder({ ...border, width: v })}
          min={0}
          max={12}
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Inner Padding</span>
          <EditableValue
            value={border.padding}
            onChange={(v) => setBorder({ ...border, padding: v })}
            min={0}
            max={80}
            suffix="px"
          />
        </div>
        <Slider
          value={[border.padding]}
          onValueChange={([v]) => setBorder({ ...border, padding: v })}
          min={0}
          max={80}
          className="cursor-pointer"
        />
      </div>

      <div>
        <SubHeader>Style</SubHeader>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {borderStyles.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                const patch: Partial<typeof border> = { style: t.id }
                if (!border.color) patch.color = "#ffffff"
                setBorder({ ...border, ...patch })
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all cursor-pointer",
                (border.style || "solid") === t.id
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-secondary/20 hover:border-foreground/30"
              )}
            >
              <div className="aspect-square w-full">{t.icon}</div>
              <span className={cn(
                "text-[9px] font-medium",
                (border.style || "solid") === t.id ? "text-primary" : "text-muted-foreground"
              )}>{t.label}</span>
            </button>
          ))}
        </div>
        <SubHeader>Color</SubHeader>
        <ColorPresetGrid
          presets={finalPresets}
          selected={enabled ? currentColor : null}
          onSelect={(c) => setBorder({ ...border, color: c })}
          customColor={isCustom ? currentColor : DEFAULT_BORDER_COLOR}
          onCustomColor={(hex) => setBorder({ ...border, color: hex })}
          isCustom={isCustom}
          customLabel="Custom border color"
        />
      </div>
    </div>
  )
}
