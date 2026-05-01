"use client"

import * as React from "react"
import {
  RiArrowLeftSLine,
  RiBallPenLine,
  RiBlurOffLine,
  RiDeleteBin6Line,
  RiEraserLine,
  RiEqualizerLine,
  RiMarkPenLine,
} from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  ANNOTATION_STROKES,
  type AnnotationLineStyle,
  type AnnotationMode,
  type AnnotationShapeKind,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type ToolDef = {
  id: AnnotationMode
  label: string
  shortcut?: string
  icon?: React.ComponentType<{ className?: string }>
}

const BRUSHES: ToolDef[] = [
  { id: "pen", label: "Pen", shortcut: "P", icon: RiBallPenLine },
  { id: "highlight", label: "Highlighter", shortcut: "H", icon: RiMarkPenLine },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: RiEraserLine },
]

const SHAPES: ToolDef[] = [
  { id: "arrow", label: "Arrow", shortcut: "A" },
  { id: "rect", label: "Rectangle", shortcut: "R" },
  {
    id: "ellipse",
    label: "Ellipse",
    shortcut: "O",
  },
  { id: "blur", label: "Blur / Redact", shortcut: "B", icon: RiBlurOffLine },
]

const LINE_STYLES: { id: AnnotationLineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Short Dash" },
]

const DEFAULT_SHAPE_COLOR = "#ef4444"

export function AnnotationToolbar({ onExit }: { onExit: () => void }) {
  const { annotation, setAnnotation, clearAnnotations } = useEditor()
  const lastShapeColorRef = React.useRef(DEFAULT_SHAPE_COLOR)
  const activeLineStyle = annotation.lineStyle
  const activeShapeKind = annotationModeToShapeKind(annotation.mode)
  const showColorControls =
    annotation.mode === "pen" ||
    annotation.mode === "highlight" ||
    Boolean(activeShapeKind)
  const showIntensityControls =
    annotation.mode === "pen" ||
    annotation.mode === "highlight" ||
    annotation.mode === "eraser"
  const showLineStyleControls =
    annotation.mode === "arrow" ||
    annotation.mode === "rect" ||
    annotation.mode === "ellipse"
  const previewShapeKind = annotationModeToShapeKind(annotation.mode) ?? "arrow"

  return (
    <div className="flex items-center gap-0.5">
      {/* Exit / mode chip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onExit}
            aria-label="Exit annotate mode"
            className="group inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg pr-2 pl-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RiArrowLeftSLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Exit annotate mode</TooltipContent>
      </Tooltip>

      <Divider />

      {/* Brushes */}
      <ToolGroup>
        {BRUSHES.map((t) => (
          <ToolButton
            key={t.id}
            tool={t}
            active={annotation.mode === t.id}
            tint={annotation.color}
            onClick={() => setAnnotation({ mode: t.id })}
          />
        ))}
      </ToolGroup>

      <Divider />

      {/* Shapes */}
      <ToolGroup>
        {SHAPES.map((t) => {
          const shapeKind = annotationModeToShapeKind(t.id)
          return (
            <ToolButton
              key={t.id}
              tool={t}
              active={annotation.mode === t.id}
              tint={annotation.color}
              iconOverride={
                shapeKind ? (
                  <LineStylePreview
                    style="solid"
                    kind={shapeKind}
                    active={annotation.mode === t.id}
                  />
                ) : undefined
              }
              onClick={() => {
                setAnnotation({
                  mode: t.id,
                  ...(shapeKind && !activeShapeKind
                    ? { color: lastShapeColorRef.current }
                    : {}),
                })
              }}
            />
          )
        })}
      </ToolGroup>

      {/* Color row */}
      {showColorControls ? (
        <>
          <Divider />
          <div className="flex items-center px-1">
            <ColorPickerPopover
              value={annotation.color}
              side="top"
              align="center"
              footer={
                activeShapeKind ? (
                  <ShapeThicknessPanel
                    value={annotation.strokeWidth}
                    color={annotation.color}
                    onChange={(strokeWidth) => setAnnotation({ strokeWidth })}
                  />
                ) : null
              }
              onChange={(hex) => {
                if (activeShapeKind) lastShapeColorRef.current = hex
                setAnnotation({ color: hex })
              }}
            >
              <button
                aria-label="Annotation color"
                title="Annotation color"
                className="relative inline-flex size-9 cursor-pointer items-center justify-center overflow-visible rounded-lg border border-border/60 bg-secondary/40 transition-colors hover:border-foreground/30 hover:bg-accent"
              >
                <span
                  className="absolute top-1.5 left-1.5 size-6 rounded-full border"
                  style={{ background: annotation.color }}
                />
                <span className="absolute top-1/2 left-1/2 grid size-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white ring-0">
                  <RiEqualizerLine className="size-3 translate-y-[0.5px]" />
                </span>
              </button>
            </ColorPickerPopover>
          </div>
        </>
      ) : null}

      {/* Stroke width */}
      {showIntensityControls ? (
        <>
          <Divider />
          <div className="flex items-center gap-0.5 px-1">
            {ANNOTATION_STROKES.map((w) => {
              const isActive = annotation.strokeWidth === w
              return (
                <Tooltip key={w}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setAnnotation({ strokeWidth: w })}
                      aria-label={`Intensity ${w}px`}
                      className={cn(
                        "inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent",
                        isActive && "bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "block rounded-full transition-all",
                          isActive ? "bg-foreground" : "bg-foreground/55"
                        )}
                        style={{ width: w + 2, height: w + 2 }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Intensity {w}px</TooltipContent>
                </Tooltip>
              )
            })}
            <IntensitySliderButton
              value={annotation.strokeWidth}
              label="Intensity"
              onChange={(strokeWidth) => setAnnotation({ strokeWidth })}
            />
          </div>
        </>
      ) : null}

      {showLineStyleControls ? (
        <>
          <Divider />
          <div className="flex items-center gap-0.5 px-1">
            {LINE_STYLES.map((style) => (
              <Tooltip key={style.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setAnnotation({ lineStyle: style.id })
                    }}
                    aria-label={`${style.label} line`}
                    className={cn(
                      "inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent",
                      activeLineStyle === style.id && "bg-accent"
                    )}
                  >
                    <LineStylePreview
                      style={style.id}
                      kind={previewShapeKind}
                      active={activeLineStyle === style.id}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{style.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}

      <Divider />

      {/* Clear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={clearAnnotations}
            aria-label="Clear all annotations"
            className="group inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <RiDeleteBin6Line className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Clear all</TooltipContent>
      </Tooltip>
    </div>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function LineStylePreview({
  style,
  kind,
  active,
}: {
  style: AnnotationLineStyle
  kind: AnnotationShapeKind
  active: boolean
}) {
  const strokeColor = active ? "text-foreground" : "text-foreground/55"
  const dashArray = lineDashArray(style)
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 overflow-visible", strokeColor)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "arrow" ? (
        <>
          <path d="M6 14L14 6" strokeDasharray={dashArray} />
          <path d="M8 6H14V12" />
        </>
      ) : kind === "rect" ? (
        <rect
          x="3.5"
          y="3.5"
          width="13"
          height="13"
          rx="2.5"
          strokeDasharray={dashArray}
        />
      ) : (
        <circle cx="10" cy="10" r="6.5" strokeDasharray={dashArray} />
      )}
    </svg>
  )
}

function ShapeThicknessPanel({
  value,
  color,
  onChange,
}: {
  value: number
  color: string
  onChange: (value: number) => void
}) {
  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Thickness
        </span>
        <span className="font-mono text-xs text-foreground/80">{value}px</span>
      </div>
      <div className="mb-3 flex items-center gap-1.5">
        {ANNOTATION_STROKES.map((strokeWidth) => {
          const isActive = value === strokeWidth
          return (
            <button
              key={strokeWidth}
              aria-label={`${strokeWidth}px thickness`}
              onClick={() => onChange(strokeWidth)}
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-md border border-transparent transition-colors hover:bg-accent",
                isActive && "border-border bg-accent"
              )}
            >
              <span
                className="block rounded-full"
                style={{
                  width: Math.min(24, strokeWidth * 2 + 6),
                  height: Math.min(24, strokeWidth * 2 + 6),
                  background: color,
                }}
              />
            </button>
          )
        })}
      </div>
      <Slider
        value={[value]}
        min={1}
        max={32}
        step={1}
        className="[&_[data-slot=slider-range]]:bg-[var(--annotation-color)]"
        style={{ "--annotation-color": color } as React.CSSProperties}
        onValueChange={([next]) => {
          if (typeof next === "number") onChange(next)
        }}
      />
    </div>
  )
}

function IntensitySliderButton({
  value,
  label,
  onChange,
}: {
  value: number
  label: string
  onChange: (value: number) => void
}) {
  const lowerLabel = label.toLowerCase()
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              aria-label={`Custom ${lowerLabel}`}
              className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent"
            >
              <span
                className="block rounded-full bg-foreground/60"
                style={{
                  width: Math.min(22, Math.max(16, value + 8)),
                  height: Math.min(22, Math.max(16, value + 8)),
                }}
              />
              <span className="absolute top-1/2 left-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white ring-0 backdrop-blur-sm">
                <RiEqualizerLine className="size-3" />
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Custom {lowerLabel}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-56 border-border/60 bg-popover/95 p-3 backdrop-blur-md"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {label}
            </span>
            <span className="font-mono text-xs text-foreground/80">
              {value}px
            </span>
          </div>
          <Slider
            value={[value]}
            min={1}
            max={32}
            step={1}
            onValueChange={([next]) => {
              if (typeof next === "number") onChange(next)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ToolButton({
  tool,
  active,
  tint,
  iconOverride,
  onClick,
}: {
  tool: ToolDef
  active: boolean
  tint: string
  iconOverride?: React.ReactNode
  onClick: () => void
}) {
  const Icon = tool.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={tool.label}
          aria-pressed={active}
          className={cn(
            "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            active && "bg-foreground/[0.08] text-foreground"
          )}
        >
          {iconOverride ?? (Icon ? <Icon className="size-4" /> : null)}
          {active && (
            <span
              className="pointer-events-none absolute bottom-1 left-1/2 h-[3px] w-3 -translate-x-1/2 rounded-full"
              style={{ background: tint }}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        <span>{tool.label}</span>
        {tool.shortcut && (
          <kbd className="rounded border border-border/60 bg-secondary/60 px-1 font-mono text-[10px] text-muted-foreground">
            {tool.shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function annotationModeToShapeKind(
  mode: AnnotationMode
): AnnotationShapeKind | null {
  if (mode === "arrow" || mode === "rect" || mode === "ellipse") return mode
  return null
}

function lineDashArray(style: AnnotationLineStyle) {
  if (style === "dashed") return "5 3"
  if (style === "dotted") return "2.2 2.2"
  return undefined
}
