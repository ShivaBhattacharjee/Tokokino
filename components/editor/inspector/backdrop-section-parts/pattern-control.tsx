"use client"

import * as React from "react"
import { RiGridLine } from "@remixicon/react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ASCII_CHARSET_OPTIONS,
  ASCII_CHARSETS,
  ASCII_MAX_RESOLUTION,
  ASCII_MIN_RESOLUTION,
  ASCII_RESOLUTION_PREVIEW_VAR,
} from "@/lib/editor/ascii-backdrop"
import type { BackdropAscii, BackdropPattern } from "@/lib/editor/state-types"
import { BACKDROP_PATTERNS, patternCssFor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { EffectSlider } from "../effect-slider"
import { ColorSwatches } from "./color-swatches"
import { BackdropControlPopover } from "./control-popover"
import { ASCII_COLOR_PRESETS, type BackdropPickerLayout } from "./constants"

const TOGGLE_ITEM_CLASS =
  "h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"

type TextureTab = "pattern" | "ascii"

/** Three ramp samples, so each tile reads as the texture it produces. */
function charsetPreview(charset: keyof typeof ASCII_CHARSETS): string {
  const ramp = ASCII_CHARSETS[charset]
  const pick = (t: number) =>
    ramp[Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))] ?? " "
  return `${pick(0.35)}${pick(0.7)}${pick(1)}`
}

export function PatternControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  pattern,
  patternActive,
  patternColors,
  ascii,
  asciiActive,
  pickerLayout,
  onOpenChange,
  onResetPattern,
  onResetAscii,
  setPattern,
  setAscii,
  setPreviewVar,
  clearPreviewVarAfterPaint,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  pattern: BackdropPattern
  patternActive: boolean
  patternColors: string[]
  ascii: BackdropAscii
  asciiActive: boolean
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onResetPattern: () => void
  onResetAscii: () => void
  setPattern: (patch: Partial<BackdropPattern>) => void
  setAscii: (patch: Partial<BackdropAscii>) => void
  setPreviewVar: (name: string, value: string | null) => void
  clearPreviewVarAfterPaint: (name: string) => void
}) {
  const [tab, setTab] = React.useState<TextureTab>(
    asciiActive && !patternActive ? "ascii" : "pattern"
  )
  const tileClass = cn(
    "relative aspect-square cursor-pointer overflow-hidden rounded-md border transition-all",
    pickerLayout === "carousel" && "h-20 w-20 shrink-0"
  )
  const pickerClass = cn(
    pickerLayout === "carousel"
      ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      : "grid grid-cols-3 gap-2 pr-1"
  )

  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      icon={RiGridLine}
      label="Texture"
      active={patternActive || asciiActive}
      title="Textures"
      description="Layer geometric patterns over the backdrop, or redraw it as ASCII."
      onReset={tab === "ascii" ? onResetAscii : onResetPattern}
      resetTitle={tab === "ascii" ? "Reset ASCII" : "Reset patterns"}
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      contentClassName="w-[240px]"
      bodyClassName="pr-1"
      footer={
        tab === "ascii" ? (
          <div className="space-y-3">
            <EffectSlider
              label="Resolution"
              value={ascii.resolution}
              onChange={(v) => {
                setAscii({ resolution: v })
                clearPreviewVarAfterPaint(ASCII_RESOLUTION_PREVIEW_VAR)
              }}
              onPreview={(v) =>
                setPreviewVar(ASCII_RESOLUTION_PREVIEW_VAR, String(v))
              }
              min={ASCII_MIN_RESOLUTION}
              max={ASCII_MAX_RESOLUTION}
              step={1}
              suffix=" cols"
            />

            <EffectSlider
              label="Opacity"
              value={ascii.opacity}
              onChange={(v) => {
                setAscii({ opacity: v })
                clearPreviewVarAfterPaint("--bd-ascii-opacity")
              }}
              onPreview={(v) =>
                setPreviewVar("--bd-ascii-opacity", `${v / 100}`)
              }
            />

            <div className="min-w-0 space-y-2">
              <span className="text-[11px] text-muted-foreground">Ink</span>
              <ToggleGroup
                type="single"
                value={ascii.colored ? "source" : "solid"}
                onValueChange={(v) =>
                  v && setAscii({ colored: v === "source" })
                }
                className="flex w-full rounded-md bg-secondary/60 p-1"
              >
                <ToggleGroupItem value="source" className={TOGGLE_ITEM_CLASS}>
                  Source colour
                </ToggleGroupItem>
                <ToggleGroupItem value="solid" className={TOGGLE_ITEM_CLASS}>
                  Single colour
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="min-w-0 space-y-2">
              <span className="text-[11px] text-muted-foreground">Ramp</span>
              <ToggleGroup
                type="single"
                value={ascii.inverted ? "inverted" : "normal"}
                onValueChange={(v) =>
                  v && setAscii({ inverted: v === "inverted" })
                }
                className="flex w-full rounded-md bg-secondary/60 p-1"
              >
                <ToggleGroupItem value="normal" className={TOGGLE_ITEM_CLASS}>
                  Normal
                </ToggleGroupItem>
                <ToggleGroupItem value="inverted" className={TOGGLE_ITEM_CLASS}>
                  Inverted
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {ascii.colored ? null : (
              <ColorSwatches
                label="Characters"
                presets={ASCII_COLOR_PRESETS}
                value={ascii.color}
                onChange={(color) => setAscii({ color })}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <EffectSlider
              label="Intensity"
              value={pattern.intensity}
              onChange={(v) => {
                setPattern({ intensity: v })
                clearPreviewVarAfterPaint("--bd-pattern-intensity")
              }}
              onPreview={(v) =>
                setPreviewVar("--bd-pattern-intensity", `${v / 100}`)
              }
            />

            <EffectSlider
              label="Thickness"
              value={pattern.thickness}
              onChange={(v) => setPattern({ thickness: v })}
              min={1}
              max={10}
              step={0.5}
              suffix="px"
            />

            <ColorSwatches
              label="Colour"
              presets={patternColors}
              value={pattern.color}
              onChange={(color) => setPattern({ color })}
            />
          </div>
        )
      }
    >
      <div className="space-y-2">
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(v) => v && setTab(v as TextureTab)}
          className="flex w-full rounded-md bg-secondary/60 p-1"
        >
          <ToggleGroupItem value="pattern" className={TOGGLE_ITEM_CLASS}>
            Pattern
            {patternActive ? (
              <span className="ml-1 size-1 rounded-full bg-current" />
            ) : null}
          </ToggleGroupItem>
          <ToggleGroupItem value="ascii" className={TOGGLE_ITEM_CLASS}>
            ASCII
            {asciiActive ? (
              <span className="ml-1 size-1 rounded-full bg-current" />
            ) : null}
          </ToggleGroupItem>
        </ToggleGroup>

        {tab === "ascii" ? (
          <div className={pickerClass}>
            <button
              onClick={() => setAscii({ enabled: false })}
              title="Off"
              className={cn(
                tileClass,
                "flex items-center justify-center bg-secondary/40 text-[10px] font-medium text-muted-foreground",
                !ascii.enabled
                  ? "border-foreground text-foreground ring-1 ring-foreground/30"
                  : "border-dashed border-border/60 hover:border-foreground/30 hover:text-foreground"
              )}
            >
              Off
            </button>
            {ASCII_CHARSET_OPTIONS.map((option) => {
              const selected = ascii.enabled && ascii.charset === option.id
              return (
                <button
                  key={option.id}
                  onClick={() =>
                    setAscii({ enabled: true, charset: option.id })
                  }
                  title={option.label}
                  className={cn(
                    tileClass,
                    "flex flex-col items-center justify-center gap-0.5 bg-neutral-900 font-mono text-[13px] leading-none text-neutral-200",
                    selected
                      ? "border-foreground ring-1 ring-foreground/30"
                      : "border-border/60 hover:border-foreground/30"
                  )}
                >
                  <span className="tracking-[0.15em]">
                    {charsetPreview(option.id)}
                  </span>
                  <span className="text-[8px] tracking-tight text-neutral-400">
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className={pickerClass}>
            <button
              key="none"
              onClick={() => setPattern({ ids: [] })}
              title="None"
              className={cn(
                tileClass,
                "flex items-center justify-center bg-secondary/40 text-[10px] font-medium text-muted-foreground",
                pattern.ids.length === 0
                  ? "border-foreground text-foreground ring-1 ring-foreground/30"
                  : "border-dashed border-border/60 hover:border-foreground/30 hover:text-foreground"
              )}
            >
              None
            </button>
            {BACKDROP_PATTERNS.map((p) => {
              const selected = pattern.ids.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setPattern({
                      ids: selected
                        ? pattern.ids.filter((v) => v !== p.id)
                        : [...pattern.ids, p.id],
                    })
                  }
                  style={patternCssFor(p.id, pattern.color, pattern.thickness)}
                  className={cn(
                    tileClass,
                    "bg-neutral-900",
                    selected
                      ? "border-foreground ring-1 ring-foreground/30"
                      : "border-border/60 hover:border-foreground/30"
                  )}
                  title={p.name}
                />
              )
            })}
          </div>
        )}
      </div>
    </BackdropControlPopover>
  )
}
