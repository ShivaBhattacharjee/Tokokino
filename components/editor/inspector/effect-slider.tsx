"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"

export function EffectSlider({
  label,
  value,
  onChange,
  onValueCommit,
  min = 0,
  max = 100,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  onValueCommit?: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  const resolvedSuffix = suffix ?? (max === 100 ? "%" : "")
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <EditableValue
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          suffix={resolvedSuffix}
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onValueCommit ? ([v]) => onValueCommit(v) : undefined}
        min={min}
        max={max}
        className="cursor-pointer"
      />
    </div>
  )
}
