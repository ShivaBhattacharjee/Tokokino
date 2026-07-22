"use client"

import * as React from "react"

import { ElasticSlider } from "@/components/elastic-slider"
import { cn } from "@/lib/utils"

function formatWithSuffix(
  value: number,
  step: number | undefined,
  suffix: string
) {
  const decimals =
    step === undefined
      ? Number.isInteger(value)
        ? 0
        : 2
      : (() => {
          const s = step.toString()
          const dot = s.indexOf(".")
          return dot === -1 ? 0 : s.length - dot - 1
        })()
  const text =
    decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals)
  return suffix ? `${text}${suffix}` : text
}

export function EffectSlider({
  label,
  value,
  onChange,
  onPreview,
  min = 0,
  max = 100,
  step = 1,
  suffix,
  disabled = false,
  className,
  sliderClassName,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  onPreview?: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  className?: string
  sliderClassName?: string
}) {
  const [draft, setDraft] = React.useState<number | null>(null)
  const displayed = draft ?? value
  const resolvedSuffix = suffix ?? (max === 100 ? "%" : "")

  return (
    <ElasticSlider
      label={label}
      value={displayed}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      formatValue={(v) => formatWithSuffix(v, step, resolvedSuffix)}
      onValueChange={(v) => {
        if (disabled) return
        setDraft(v)
        onPreview?.(v)
        // Without a live-preview path, commit continuously (history groups).
        if (!onPreview) onChange(v)
      }}
      onValueCommit={(v) => {
        if (disabled) return
        setDraft(null)
        onChange(v)
      }}
      className={cn(className, sliderClassName)}
    />
  )
}
