"use client"

import * as React from "react"
import {
  RiAddLine,
  RiAlignCenter,
  RiAlignLeft,
  RiAlignRight,
  RiBringToFront,
  RiCheckboxBlankLine,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiFileCopyLine,
  RiFontFamily,
  RiMoreFill,
  RiSendToBack,
  RiSubtractLine,
} from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FONT_FAMILIES,
  sampleImageColorsRaw,
  type BorderStyle,
  type TextAlign,
  type TextElement,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const ALIGN_ORDER: TextAlign[] = ["left", "center", "right"]
const ALIGN_ICONS: Record<
  TextAlign,
  React.ComponentType<{ className?: string }>
> = {
  left: RiAlignLeft,
  center: RiAlignCenter,
  right: RiAlignRight,
}

const POPOVER_CLASS = "border-border/60 bg-popover/95 backdrop-blur-md"

const iconBtnClass =
  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shrink-0"

type DragHandlers = {
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void
}

export function TextToolbar({
  text,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
}: { text: TextElement } & DragHandlers) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TextToolbarBody
        text={text}
        onDragHandlePointerDown={onDragHandlePointerDown}
        onDragHandlePointerMove={onDragHandlePointerMove}
        onDragHandlePointerUp={onDragHandlePointerUp}
      />
    </div>
  )
}

function TextToolbarBody({
  text,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
}: { text: TextElement } & DragHandlers) {
  const {
    updateText,
    deleteText,
    duplicateText,
    bringTextToFront,
    sendTextToBack,
    setSelectedTextId,
  } = useEditor()

  const [moreOpen, setMoreOpen] = React.useState(false)

  const setSize = (n: number) =>
    updateText(text.id, { fontSize: Math.max(8, Math.min(200, n)) })

  const AlignIcon = ALIGN_ICONS[text.align]

  const cycleAlign = () => {
    const idx = ALIGN_ORDER.indexOf(text.align)
    const next = ALIGN_ORDER[(idx + 1) % ALIGN_ORDER.length]
    updateText(text.id, { align: next })
  }

  return (
    <>
      {/* Drag handle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Drag text"
            onPointerDown={onDragHandlePointerDown}
            onPointerMove={onDragHandlePointerMove}
            onPointerUp={onDragHandlePointerUp}
            onPointerCancel={onDragHandlePointerUp}
            className={cn(
              iconBtnClass,
              "rounded-full border border-border/60 cursor-grab active:cursor-grabbing"
            )}
          >
            <RiDragMove2Line className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Drag to move</TooltipContent>
      </Tooltip>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Delete */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              deleteText(text.id)
              setSelectedTextId(null)
            }}
            aria-label="Delete text"
            className={cn(iconBtnClass, "text-red-500 hover:text-red-500")}
          >
            <RiDeleteBinLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete</TooltipContent>
      </Tooltip>

      {/* Duplicate */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              const id = duplicateText(text.id)
              if (id) setSelectedTextId(id)
            }}
            aria-label="Duplicate text"
            className={iconBtnClass}
          >
            <RiFileCopyLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Duplicate</TooltipContent>
      </Tooltip>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Font size controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setSize(text.fontSize - 1)}
            aria-label="Decrease font size"
            className={iconBtnClass}
          >
            <RiSubtractLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Decrease size</TooltipContent>
      </Tooltip>
      <input
        type="number"
        value={text.fontSize}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) setSize(v)
        }}
        aria-label="Font size"
        title="Font size"
        className="h-9 w-12 shrink-0 rounded-md bg-secondary/60 text-center font-mono text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setSize(text.fontSize + 1)}
            aria-label="Increase font size"
            className={iconBtnClass}
          >
            <RiAddLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Increase size</TooltipContent>
      </Tooltip>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Font family */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button aria-label="Font family" className={iconBtnClass}>
                <RiFontFamily className="size-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Font family</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={10}
          className={cn("w-44 p-1", POPOVER_CLASS)}
        >
          <div className="flex flex-col">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.id}
                onClick={() => updateText(text.id, { fontFamily: f.css })}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent cursor-pointer",
                  text.fontFamily === f.css && "bg-accent text-foreground"
                )}
                style={{ fontFamily: f.css }}
              >
                <span>{f.label}</span>
                <span className="text-xs text-muted-foreground">Aa</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Text color — title only; ColorPickerPopover wraps with PopoverTrigger asChild and won't accept a Tooltip provider as its child */}
      <ColorPickerPopover
        value={text.color}
        side="top"
        align="center"
        onChange={(hex) => updateText(text.id, { color: hex, autoColor: false })}
      >
        <button
          aria-label="Text color"
          title="Text color"
          className={cn(iconBtnClass, "relative")}
        >
          <span
            className="size-5 rounded-full border border-border/70 shadow-inner"
            style={{ backgroundColor: text.color }}
          />
        </button>
      </ColorPickerPopover>

      {/* Border */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button aria-label="Text border" className={iconBtnClass}>
                {text.borderColor ? (
                  <span
                    className="size-5 rounded-md border-2"
                    style={{ borderColor: text.borderColor, borderStyle: text.borderStyle || "solid" }}
                  />
                ) : (
                  <RiCheckboxBlankLine className="size-4" />
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Border</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={10}
          className={cn("w-64 p-3", POPOVER_CLASS)}
        >
          <TextBorderSettings text={text} updateText={updateText} />
        </PopoverContent>
      </Popover>

      {/* Alignment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={cycleAlign}
            aria-label={`Alignment: ${text.align}`}
            className={iconBtnClass}
          >
            <AlignIcon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="capitalize">
          Align {text.align}
        </TooltipContent>
      </Tooltip>

      {/* More options */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button aria-label="More options" className={iconBtnClass}>
                <RiMoreFill className="size-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">More options</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className={cn("w-44 p-1", POPOVER_CLASS)}
        >
          <div className="flex flex-col">
            <button
              onClick={() => {
                bringTextToFront(text.id)
                setMoreOpen(false)
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent cursor-pointer"
            >
              <RiBringToFront className="size-4" />
              Bring to front
            </button>
            <button
              onClick={() => {
                sendTextToBack(text.id)
                setMoreOpen(false)
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent cursor-pointer"
            >
              <RiSendToBack className="size-4" />
              Send to back
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

/* ---- Border settings sub-component ---- */

const TEXT_BORDER_PRESETS = [
  "#ffffff",
  "#000000",
  "#f08a9a",
  "#fde2e4",
  "#92b97a",
  "#60a5fa",
]

const TEXT_BORDER_STYLES: { id: BorderStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
  { id: "double", label: "Double" },
  { id: "groove", label: "Groove" },
  { id: "ridge", label: "Ridge" },
]

function TextBorderSettings({
  text,
  updateText,
}: {
  text: TextElement
  updateText: (id: string, patch: Partial<TextElement>) => void
}) {
  const enabled = text.borderColor !== null
  const currentColor = text.borderColor || "#ffffff"
  const currentStyle = text.borderStyle || "solid"
  const isCustomColor =
    enabled &&
    !TEXT_BORDER_PRESETS.some((c) => c.toLowerCase() === currentColor.toLowerCase())

  return (
    <div className="flex flex-col gap-3">
      {/* Enable / disable */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">Border</span>
        <button
          onClick={() =>
            updateText(text.id, {
              borderColor: enabled ? null : "#ffffff",
              borderWidth: enabled ? text.borderWidth : Math.max(1, text.borderWidth),
            })
          }
          className={cn(
            "h-5 w-9 rounded-full transition-colors cursor-pointer",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "block size-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Color presets */}
      <div>
        <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Color</span>
        <div className="grid grid-cols-7 gap-1.5">
          {TEXT_BORDER_PRESETS.map((c) => {
            const active =
              enabled && currentColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                onClick={() => updateText(text.id, { borderColor: c })}
                className={cn(
                  "aspect-square rounded-full border cursor-pointer transition-all",
                  active
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background border-transparent"
                    : "border-border/60 hover:scale-110"
                )}
              >
                <span
                  className="block size-full rounded-full"
                  style={{ background: c }}
                />
              </button>
            )
          })}
          {/* Custom color */}
          <ColorPickerPopover
            value={isCustomColor ? currentColor : "#ffffff"}
            onChange={(hex) => updateText(text.id, { borderColor: hex })}
            side="top"
            align="center"
          >
            <button
              className={cn(
                "relative aspect-square rounded-full border cursor-pointer transition-all",
                isCustomColor
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-background border-transparent"
                  : "border-border/60 hover:scale-110"
              )}
              aria-label="Custom border color"
            >
              <span
                className="block size-full rounded-full"
                style={{
                  background: isCustomColor ? currentColor : undefined,
                  backgroundImage: isCustomColor
                    ? undefined
                    : "conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)",
                }}
              />
            </button>
          </ColorPickerPopover>
        </div>
      </div>

      {/* Width */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground">Width</span>
          <span className="font-mono text-[10px] text-foreground">{text.borderWidth}px</span>
        </div>
        <Slider
          min={0}
          max={12}
          step={1}
          value={[text.borderWidth]}
          onValueChange={([v]) => updateText(text.id, { borderWidth: v, borderColor: text.borderColor || "#ffffff" })}
          className="cursor-pointer"
        />
      </div>

      {/* Style */}
      <div>
        <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Style</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_BORDER_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => updateText(text.id, { borderStyle: s.id, borderColor: text.borderColor || "#ffffff" })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all cursor-pointer",
                currentStyle === s.id
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-secondary/20 hover:border-foreground/30"
              )}
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-muted/50 p-1.5">
                <div
                  className="size-full rounded-[2px] border-[2px]"
                  style={{ borderStyle: s.id, borderColor: "currentColor" }}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium",
                  currentStyle === s.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
