"use client"

import * as React from "react"
import { RiArrowRightLine, RiFocus3Line } from "@remixicon/react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { ColorPresetGrid, SubHeader } from "./primitives"

const SHADOW_COLOR_PRESETS = [
  "#000000",
  "#1e293b",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
]

const LIGHT_POSITIONS = Array.from({ length: 25 }, (_, i) => {
  const r = Math.floor(i / 5)
  const c = i % 5
  const dx = c - 2
  const dy = r - 2
  const isCenter = dx === 0 && dy === 0
  return {
    id: isCenter ? "center" : `${r}-${c}`,
    isCenter,
    angle: isCenter ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI,
  }
})

export function ShadowSection() {
  const { shadow, setShadow } = useEditor()
  const { type, intensity, lightSource, color = "#000000" } = shadow

  const setType = (t: typeof shadow.type) => {
    if (t === "hard") {
      setShadow({ ...shadow, type: t, intensity: 100, lightSource: "2-0" })
      return
    }
    setShadow({ ...shadow, type: t })
  }
  const setIntensity = (n: number) => setShadow({ ...shadow, intensity: n })
  const setLightSource = (id: string) => setShadow({ ...shadow, lightSource: id })
  const setColor = (c: string) => setShadow({ ...shadow, color: c })

  const thumbBg = "bg-[#d1d5db]"
  const thumbCard = "rounded-[3px] bg-white"

  const types = [
    {
      id: "none" as const, label: "None", icon: (
        <div className={cn("size-full rounded-sm p-3", thumbBg)}>
          <div className="size-full rounded-[3px] border-2 border-dashed border-gray-400" />
        </div>
      )
    },
    {
      id: "drop" as const, label: "Drop", icon: (
        <div className={cn("size-full rounded-sm p-3 pb-4 pr-4", thumbBg)}>
          <div className={cn("size-full shadow-[5px_5px_8px_0px_rgba(0,0,0,0.45)]", thumbCard)} />
        </div>
      )
    },
    {
      id: "soft" as const, label: "Soft", icon: (
        <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
          <div className={cn("size-full shadow-[0_8px_20px_2px_rgba(0,0,0,0.3)]", thumbCard)} />
        </div>
      )
    },
    {
      id: "hard" as const, label: "Hard", icon: (
        <div className={cn("size-full rounded-sm p-3 pb-4 pr-4", thumbBg)}>
          <div className={cn("size-full shadow-[5px_5px_0px_0px_rgba(0,0,0,0.75)]", thumbCard)} />
        </div>
      )
    },
    {
      id: "glow" as const, label: "Glow", icon: (
        <div className={cn("size-full rounded-sm p-3", thumbBg)}>
          <div className={cn("size-full shadow-[0_0_14px_3px_rgba(0,0,0,0.35)]", thumbCard)} />
        </div>
      )
    },
    {
      id: "float" as const, label: "Float", icon: (
        <div className={cn("size-full rounded-sm px-3 pt-2 pb-5", thumbBg)}>
          <div className={cn("size-full shadow-[0_4px_6px_0px_rgba(0,0,0,0.25),0_12px_20px_0px_rgba(0,0,0,0.2)]", thumbCard)} />
        </div>
      )
    },
  ]

  const isDisabled = type === "none"
  const lightSourceDisabled = isDisabled || type === "glow" || type === "float"
  const isCustomColor = !SHADOW_COLOR_PRESETS.includes(color)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all cursor-pointer",
              type === t.id
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div className="aspect-square w-full">{t.icon}</div>
            <span className={cn(
              "text-[9px] font-medium",
              type === t.id ? "text-primary" : "text-muted-foreground"
            )}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={cn(isDisabled && "pointer-events-none opacity-50")}>
        <SubHeader>Color</SubHeader>
        <ColorPresetGrid
          presets={SHADOW_COLOR_PRESETS}
          selected={isCustomColor ? null : color}
          onSelect={setColor}
          customColor={isCustomColor ? color : "#000000"}
          onCustomColor={setColor}
          isCustom={isCustomColor}
          customLabel="Custom shadow color"
        />
      </div>

      <div className={cn(isDisabled && "pointer-events-none opacity-50")}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Intensity</span>
          <EditableValue
            value={intensity}
            onChange={setIntensity}
            min={0}
            max={100}
            suffix="%"
          />
        </div>
        <Slider value={[intensity]} onValueChange={([v]) => setIntensity(v)} max={100} className="cursor-pointer" />
      </div>

      <div className={cn(lightSourceDisabled && "pointer-events-none opacity-50")}>
        <SubHeader>Light Source</SubHeader>
        <div className="mt-2">
          <div className="grid grid-cols-5 gap-1.5 w-full">
            {LIGHT_POSITIONS.map((pos) => {
              const isActive = lightSource === pos.id
              return (
                <button
                  key={pos.id}
                  onClick={() => setLightSource(pos.id)}
                  className={cn(
                    "flex w-full aspect-square items-center justify-center rounded-md border transition-all cursor-pointer",
                    isActive
                      ? "border-primary bg-primary text-white"
                      : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {pos.isCenter ? (
                    <RiFocus3Line className="size-3.5" />
                  ) : (
                    <RiArrowRightLine
                      className="size-3.5"
                      style={{ transform: `rotate(${pos.angle}deg)` }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
