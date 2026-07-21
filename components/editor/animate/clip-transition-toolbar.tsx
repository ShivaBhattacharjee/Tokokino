"use client"

import * as React from "react"
import { RiArrowGoBackLine } from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  CLIP_EASING_KINDS,
  CLIP_EASING_LABELS,
  clipEasingKind,
  clipReturnsToDefault,
  clipSpeed,
  DEFAULT_CLIP_EASING,
  DEFAULT_CLIP_SPEED,
  effectiveActiveMs,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  type ClipEasingKind,
} from "@/lib/editor/clip-easing"
import type { AnimationClip } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { EasingCurve } from "./easing-curve"

type ClipTransitionButtonProps = {
  clip: AnimationClip
  onUpdate: (patch: Partial<AnimationClip>) => void
  /** While playing, keep the control visible but non-interactive. */
  disabled?: boolean
  className?: string
}

/**
 * The selected clip's transition control, shown inline in the animate controls
 * bar: a curve + duration button that opens the Transition popover (easing curve
 * + speed). Applies to every animation type — position, zoom, background, etc.
 */
export function ClipTransitionButton({
  clip,
  onUpdate,
  disabled = false,
  className,
}: ClipTransitionButtonProps) {
  const kind = clipEasingKind(clip)
  const [open, setOpen] = React.useState(false)

  return (
    // Controlled so hitting play (which disables the trigger) also force-closes
    // an already-open popover instead of leaving it floating.
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Transition"
          disabled={disabled}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-foreground/8 px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15 disabled:pointer-events-none disabled:opacity-50",
            className
          )}
        >
          <span className="flex size-4 items-center justify-center">
            <EasingCurve kind={kind} strokeClassName="stroke-foreground/70" />
          </span>
          <span className="tabular-nums">{effectiveActiveMs(clip)}ms</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-60 rounded-md p-2.5 pb-3"
      >
        <TransitionPanel clip={clip} onUpdate={onUpdate} />
      </PopoverContent>
    </Popover>
  )
}

function TransitionPanel({
  clip,
  onUpdate,
}: {
  clip: AnimationClip
  onUpdate: (patch: Partial<AnimationClip>) => void
}) {
  const kind = clipEasingKind(clip)
  const speed = clipSpeed(clip)
  const [hovered, setHovered] = React.useState<ClipEasingKind | null>(null)

  const returns = clipReturnsToDefault(clip)

  const reset = () =>
    onUpdate({
      easing: DEFAULT_CLIP_EASING,
      speed: DEFAULT_CLIP_SPEED,
      returnToDefault: true,
    })

  // The slider is driven by the effective transition duration in ms, not the raw
  // speed multiplier: RIGHT (max) = the full clip window (speed 1), and dragging
  // LEFT shortens it (higher speed) — so "1200ms" reads as a full bar you reduce.
  const fullMs = Math.max(1, Math.round(clip.durationMs))
  const minMs = Math.max(1, Math.round(clip.durationMs / MAX_CLIP_SPEED))
  const maxMs = Math.max(minMs + 1, fullMs)
  const activeMs = Math.min(maxMs, Math.max(minMs, effectiveActiveMs(clip)))
  const onSpeedMs = (ms: number) => {
    const next = clip.durationMs / Math.max(1, ms)
    onUpdate({
      speed: Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, next)),
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">
          Transition
        </span>
        <button
          type="button"
          aria-label="Reset transition"
          onClick={reset}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <RiArrowGoBackLine className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {CLIP_EASING_KINDS.map((k) => {
          const active = k === kind
          return (
            <button
              key={k}
              type="button"
              onClick={() => onUpdate({ easing: k })}
              onPointerEnter={() => setHovered(k)}
              onPointerLeave={() => setHovered((h) => (h === k ? null : h))}
              onFocus={() => setHovered(k)}
              onBlur={() => setHovered((h) => (h === k ? null : h))}
              className="group flex flex-col items-center gap-1 outline-none"
            >
              <span
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-md border p-2 transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-muted/40 group-hover:border-border group-focus-visible:border-ring"
                )}
              >
                <EasingCurve
                  kind={k}
                  animate={hovered === k}
                  speed={speed}
                  strokeClassName={
                    active
                      ? "stroke-primary-foreground"
                      : "stroke-foreground/45"
                  }
                  dotClassName={
                    active ? "fill-primary-foreground" : "fill-primary"
                  }
                />
              </span>
              <span
                className={cn(
                  "text-[11px] transition-colors",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {CLIP_EASING_LABELS[k]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Speed</span>
          <span className="text-foreground tabular-nums">{activeMs}ms</span>
        </div>
        <Slider
          value={[activeMs]}
          min={minMs}
          max={maxMs}
          step={1}
          aria-label="Transition speed"
          onValueChange={([v]) => onSpeedMs(v)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-col">
          <span className="text-[11px] text-foreground">Return to default</span>
          <span className="text-[10px] text-muted-foreground">
            Unwinds over {activeMs}ms after the clip
          </span>
        </div>
        <Switch
          size="sm"
          checked={returns}
          aria-label="Return to default after the clip"
          onCheckedChange={(v) => onUpdate({ returnToDefault: v })}
        />
      </div>
    </div>
  )
}
