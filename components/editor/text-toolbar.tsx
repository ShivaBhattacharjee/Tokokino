"use client"

import * as React from "react"
import {
  RiAddLine,
  RiAlignCenter,
  RiAlignLeft,
  RiAlignRight,
  RiCheckboxBlankLine,
  RiFontFamily,
  RiSearchLine,
  RiSettings4Fill,
  RiSettings4Line,
  RiSubtractLine,
} from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  iconBtnClass,
  ToolbarButton,
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  ToolbarPopover,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  FONT_FAMILIES,
  type FontCategory,
  type BorderStyle,
  type TextAlign,
  type TextElement,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const TEXT_EFFECTS: {
  id: string
  label: string
  previewStyle: React.CSSProperties
  patch: Partial<TextElement>
}[] = [
  {
    id: "sticker",
    label: "Sticker",
    previewStyle: {
      color: "#1a237e",
      WebkitTextStroke: "6px #ffffff",
      paintOrder: "stroke fill",
    },
    patch: {
      strokeColor: "#ffffff",
      strokeWidth: 6,
      textShadow: null,
    },
  },
  {
    id: "glow",
    label: "Glow",
    previewStyle: {
      color: "#ffffff",
      textShadow:
        "0 0 8px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6)",
    },
    patch: {
      strokeColor: null,
      strokeWidth: 0,
      textShadow:
        "0 0 8px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6)",
    },
  },
  {
    id: "shadow",
    label: "Shadow",
    previewStyle: {
      color: "#ffffff",
      textShadow: "3px 3px 0px rgba(0,0,0,0.8)",
    },
    patch: {
      strokeColor: null,
      strokeWidth: 0,
      textShadow: "3px 3px 0px rgba(0,0,0,0.8)",
    },
  },
]

const ALIGN_ORDER: TextAlign[] = ["left", "center", "right"]
const ALIGN_ICONS: Record<
  TextAlign,
  React.ComponentType<{ className?: string }>
> = {
  left: RiAlignLeft,
  center: RiAlignCenter,
  right: RiAlignRight,
}

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
    <ToolbarSurface>
      <TextToolbarBody
        text={text}
        onDragHandlePointerDown={onDragHandlePointerDown}
        onDragHandlePointerMove={onDragHandlePointerMove}
        onDragHandlePointerUp={onDragHandlePointerUp}
      />
    </ToolbarSurface>
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

  const [fontQuery, setFontQuery] = React.useState("")
  const [fontCategory, setFontCategory] = React.useState<"all" | FontCategory>(
    "all"
  )
  const [fontSettingsOpen, setFontSettingsOpen] = React.useState(false)
  const [fontSizeInput, setFontSizeInput] = React.useState(
    String(text.fontSize)
  )
  const fontSizePointerHandledRef = React.useRef(false)

  const setSize = React.useCallback(
    (n: number) =>
      updateText(text.id, { fontSize: Math.max(8, Math.min(200, n)) }),
    [text.id, updateText]
  )

  const changeFontSize = React.useCallback(
    (delta: number) => setSize(text.fontSize + delta),
    [setSize, text.fontSize]
  )

  const onFontSizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, delta: number) => {
      fontSizePointerHandledRef.current = true
      e.preventDefault()
      e.stopPropagation()
      changeFontSize(delta)
    },
    [changeFontSize]
  )

  const onFontSizeClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, delta: number) => {
      e.preventDefault()
      e.stopPropagation()
      if (fontSizePointerHandledRef.current) {
        fontSizePointerHandledRef.current = false
        return
      }
      changeFontSize(delta)
    },
    [changeFontSize]
  )

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFontSizeInput(String(text.fontSize))
  }, [text.fontSize])

  const commitFontSize = React.useCallback(() => {
    const next = Number(fontSizeInput)
    if (!Number.isFinite(next) || next <= 0) {
      setFontSizeInput(String(text.fontSize))
      return
    }
    setSize(next)
  }, [fontSizeInput, text.fontSize, setSize])

  const AlignIcon = ALIGN_ICONS[text.align]

  const cycleAlign = () => {
    const idx = ALIGN_ORDER.indexOf(text.align)
    const next = ALIGN_ORDER[(idx + 1) % ALIGN_ORDER.length]
    updateText(text.id, { align: next })
  }

  const normalizedQuery = fontQuery.trim().toLowerCase()
  const visibleFonts = FONT_FAMILIES.filter((f) => {
    const categoryOk = fontCategory === "all" || f.category === fontCategory
    if (!categoryOk) return false
    if (!normalizedQuery) return true
    return (
      f.label.toLowerCase().includes(normalizedQuery) ||
      f.category.toLowerCase().includes(normalizedQuery)
    )
  })

  return (
    <>
      <ToolbarDragHandle
        ariaLabel="Drag text"
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerUp}
      />

      <ToolbarDivider />

      <ToolbarDeleteButton
        ariaLabel="Delete text"
        onDelete={() => {
          deleteText(text.id)
          setSelectedTextId(null)
        }}
      />

      <ToolbarDuplicateButton
        ariaLabel="Duplicate text"
        onDuplicate={() => {
          const id = duplicateText(text.id)
          if (id) setSelectedTextId(id)
        }}
      />

      <ToolbarDivider />

      <ToolbarButton
        aria-label="Decrease font size"
        tooltip="Decrease size"
        onPointerDown={(e) => onFontSizePointerDown(e, -1)}
        onClick={(e) => onFontSizeClick(e, -1)}
      >
        <RiSubtractLine className="size-4" />
      </ToolbarButton>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={fontSizeInput}
        onChange={(e) => {
          const next = e.target.value
          setFontSizeInput(next)
          if (next === "") return
          const parsed = Number(next)
          if (Number.isFinite(parsed) && parsed > 0) setSize(parsed)
        }}
        onBlur={commitFontSize}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitFontSize()
          }
        }}
        aria-label="Font size"
        title="Font size"
        className="h-9 w-12 shrink-0 touch-manipulation rounded-md bg-secondary/60 text-center font-mono text-[16px] text-foreground outline-none focus:ring-1 focus:ring-ring"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      />
      <ToolbarButton
        aria-label="Increase font size"
        tooltip="Increase size"
        onPointerDown={(e) => onFontSizePointerDown(e, 1)}
        onClick={(e) => onFontSizeClick(e, 1)}
      >
        <RiAddLine className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Font family */}
      <ToolbarPopover
        tooltip="Font family"
        contentClassName="w-72 p-2"
        trigger={({ open }) => (
          <ToolbarButton aria-label="Font family" active={open}>
            <RiFontFamily className="size-4" />
          </ToolbarButton>
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fontQuery}
                onChange={(e) => setFontQuery(e.target.value)}
                placeholder="Search fonts..."
                className="h-8 !pl-8 text-[12px]"
              />
            </div>
            <button
              onClick={() => setFontSettingsOpen((v) => !v)}
              aria-label="Typography settings"
              className={cn(
                "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border/60 transition-colors",
                fontSettingsOpen
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {fontSettingsOpen ? (
                <RiSettings4Fill className="size-4" />
              ) : (
                <RiSettings4Line className="size-4" />
              )}
            </button>
          </div>

          <div className="h-72 rounded-md border border-border/50 bg-secondary/30 p-2">
            {fontSettingsOpen ? (
              <div className="h-full overflow-y-auto">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Typography
                  </span>
                  <button
                    onClick={() =>
                      updateText(text.id, {
                        fontWeight: 500,
                        lineHeight: 1.3,
                        letterSpacing: 0,
                        strokeColor: null,
                        strokeWidth: 0,
                        textShadow: null,
                      })
                    }
                    className="cursor-pointer rounded-md border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Reset
                  </button>
                </div>

                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Weight
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {text.fontWeight}
                  </span>
                </div>
                <Slider
                  value={[text.fontWeight]}
                  min={100}
                  max={900}
                  step={100}
                  onValueChange={([v]) =>
                    updateText(text.id, { fontWeight: v })
                  }
                />

                <div className="mt-3 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Line Height
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {(text.lineHeight ?? 1.3).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[text.lineHeight ?? 1.3]}
                  min={0.8}
                  max={2.4}
                  step={0.05}
                  onValueChange={([v]) =>
                    updateText(text.id, { lineHeight: Number(v.toFixed(2)) })
                  }
                />

                <div className="mt-3 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Letter Spacing
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {(text.letterSpacing ?? 0).toFixed(1)}px
                  </span>
                </div>
                <Slider
                  value={[text.letterSpacing ?? 0]}
                  min={-2}
                  max={20}
                  step={0.1}
                  onValueChange={([v]) =>
                    updateText(text.id, { letterSpacing: Number(v.toFixed(1)) })
                  }
                />

                <div className="mt-3 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Stroke Width
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {(text.strokeWidth ?? 0).toFixed(1)}px
                  </span>
                </div>
                <Slider
                  value={[text.strokeWidth ?? 0]}
                  min={0}
                  max={10}
                  step={0.5}
                  onValueChange={([v]) =>
                    updateText(text.id, {
                      strokeWidth: v,
                      strokeColor: v > 0 ? text.strokeColor || "#000000" : null,
                    })
                  }
                />

                <div className="mt-3 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Stroke Color
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ColorPickerPopover
                    value={text.strokeColor || "#000000"}
                    onChange={(hex) =>
                      updateText(text.id, {
                        strokeColor: hex,
                        strokeWidth:
                          text.strokeWidth && text.strokeWidth > 0
                            ? text.strokeWidth
                            : 1,
                      })
                    }
                    side="top"
                    align="center"
                  >
                    <button
                      aria-label="Stroke color"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border/60 transition-colors hover:bg-accent"
                    >
                      <span
                        className="size-4 rounded-full border border-border/70"
                        style={{
                          backgroundColor: text.strokeColor || "#000000",
                        }}
                      />
                    </button>
                  </ColorPickerPopover>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {text.strokeColor || "#000000"}
                  </span>
                </div>

                <div className="mt-3 mb-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Quick Effects
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {TEXT_EFFECTS.map((effect) => (
                    <button
                      key={effect.id}
                      onClick={() => updateText(text.id, effect.patch)}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1.5 transition-all",
                        "border-border/60 bg-secondary/20 hover:border-foreground/30"
                      )}
                    >
                      <span
                        className="text-[13px] leading-none font-black"
                        style={effect.previewStyle}
                      >
                        Aa
                      </span>
                      <span className="text-[9px] font-medium text-muted-foreground">
                        {effect.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: "all", label: "All" },
                    { id: "sans", label: "Sans" },
                    { id: "serif", label: "Serif" },
                    { id: "mono", label: "Mono" },
                    { id: "script", label: "Script" },
                    { id: "system", label: "System" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setFontCategory(opt.id as "all" | FontCategory)
                      }
                      className={cn(
                        "cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                        fontCategory === opt.id
                          ? "bg-accent text-foreground"
                          : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/50 p-1">
                  <div className="flex flex-col gap-0.5">
                    {visibleFonts.map((f) => (
                      <button
                        key={f.id}
                        onClick={() =>
                          updateText(text.id, { fontFamily: f.css })
                        }
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                          text.fontFamily === f.css &&
                            "bg-accent text-foreground"
                        )}
                        style={{ fontFamily: f.css }}
                      >
                        <span>{f.label}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {f.category}
                        </span>
                      </button>
                    ))}
                    {visibleFonts.length === 0 ? (
                      <p className="px-2 py-4 text-center font-mono text-[10px] text-muted-foreground">
                        No fonts found
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolbarPopover>

      {/* Text color — title only; ColorPickerPopover wraps with PopoverTrigger asChild and won't accept a Tooltip provider as its child */}
      <ColorPickerPopover
        value={text.color}
        side="top"
        align="center"
        onChange={(hex) =>
          updateText(text.id, { color: hex, autoColor: false })
        }
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
      <ToolbarPopover
        tooltip="Border"
        contentClassName="w-64 p-3"
        trigger={({ open }) => (
          <ToolbarButton aria-label="Text border" active={open}>
            {text.borderColor ? (
              <span
                className="size-5 rounded-md border-2"
                style={{
                  borderColor: text.borderColor,
                  borderStyle: text.borderStyle || "solid",
                }}
              />
            ) : (
              <RiCheckboxBlankLine className="size-4" />
            )}
          </ToolbarButton>
        )}
      >
        <TextBorderSettings text={text} updateText={updateText} />
      </ToolbarPopover>

      {/* Alignment */}
      <ToolbarButton
        aria-label={`Alignment: ${text.align}`}
        tooltip={<span className="capitalize">Align {text.align}</span>}
        onClick={cycleAlign}
      >
        <AlignIcon className="size-4" />
      </ToolbarButton>

      <ToolbarLayerOrderMenu
        onBringToFront={() => bringTextToFront(text.id)}
        onSendToBack={() => sendTextToBack(text.id)}
      />
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
    !TEXT_BORDER_PRESETS.some(
      (c) => c.toLowerCase() === currentColor.toLowerCase()
    )

  return (
    <div className="flex flex-col gap-3">
      {/* Enable / disable */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">Border</span>
        <button
          onClick={() =>
            updateText(text.id, {
              borderColor: enabled ? null : "#ffffff",
              borderWidth: enabled
                ? text.borderWidth
                : Math.max(1, text.borderWidth),
            })
          }
          className={cn(
            "h-5 w-9 cursor-pointer rounded-full transition-colors",
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
        <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
          Color
        </span>
        <div className="grid grid-cols-7 gap-1.5">
          {TEXT_BORDER_PRESETS.map((c) => {
            const active =
              enabled && currentColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                onClick={() => updateText(text.id, { borderColor: c })}
                className={cn(
                  "aspect-square cursor-pointer rounded-full border transition-all",
                  active
                    ? "border-transparent ring-2 ring-primary ring-offset-1 ring-offset-background"
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
                "relative aspect-square cursor-pointer rounded-full border transition-all",
                isCustomColor
                  ? "border-transparent ring-2 ring-primary ring-offset-1 ring-offset-background"
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
          <span className="text-[10px] font-medium text-muted-foreground">
            Width
          </span>
          <span className="font-mono text-[10px] text-foreground">
            {text.borderWidth}px
          </span>
        </div>
        <Slider
          min={0}
          max={12}
          step={1}
          value={[text.borderWidth]}
          onValueChange={([v]) =>
            updateText(text.id, {
              borderWidth: v,
              borderColor: text.borderColor || "#ffffff",
            })
          }
          className="cursor-pointer"
        />
      </div>

      {/* Style */}
      <div>
        <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
          Style
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_BORDER_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() =>
                updateText(text.id, {
                  borderStyle: s.id,
                  borderColor: text.borderColor || "#ffffff",
                })
              }
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1.5 transition-all",
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
                  currentStyle === s.id
                    ? "text-primary"
                    : "text-muted-foreground"
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
