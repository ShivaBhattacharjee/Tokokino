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
import { ElasticSlider } from "@/components/elastic-slider"
import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  ToolbarDivider,
  ToolbarPopover,
} from "@/components/editor/toolbar/primitives"
import {
  ANNOTATION_STROKES,
  type AnnotationLineStyle,
  type AnnotationMode,
  type AnnotationBlurEffect,
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
  { id: "step", label: "Step markers", shortcut: "S" },
]

const LINE_STYLES: { id: AnnotationLineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Short Dash" },
]

const REDACTION_TEMPLATES: {
  id: AnnotationBlurEffect
  label: string
}[] = [
  { id: "blur", label: "Blur" },
  { id: "redact", label: "Solid redact" },
  { id: "redact-stripe", label: "Striped redact" },
  { id: "pixelate", label: "Pixel redact" },
]

const DEFAULT_SHAPE_COLOR = "#ef4444"

export function AnnotationToolbar({ onExit }: { onExit: () => void }) {
  const { annotation, setAnnotation, clearAnnotations } = useEditor()
  const lastShapeColorRef = React.useRef(DEFAULT_SHAPE_COLOR)
  const activeLineStyle = annotation.lineStyle
  const activeShapeKind = annotationModeToShapeKind(annotation.mode)
  const activeRedactionEffect = annotation.blurEffect
  const showColorControls =
    annotation.mode === "pen" ||
    annotation.mode === "highlight" ||
    Boolean(activeShapeKind && activeShapeKind !== "blur")
  const showIntensityControls =
    annotation.mode === "pen" ||
    annotation.mode === "highlight" ||
    annotation.mode === "eraser"
  const showLineStyleControls =
    annotation.mode === "arrow" ||
    annotation.mode === "rect" ||
    annotation.mode === "ellipse"
  const showThicknessInColorPicker =
    annotation.mode !== "step" && annotation.mode !== "blur"
  const previewShapeKind = annotationModeToShapeKind(annotation.mode) ?? "arrow"

  return (
    <div className="flex min-w-0 items-center">
      {/* Fixed: back button */}
      <div className="flex flex-shrink-0 items-center">
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
      </div>

      {/* Scrollable tools */}
      <div className="flex min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-0.5">
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
              const isActive = annotation.mode === t.id
              return (
                <ToolButton
                  key={t.id}
                  tool={t}
                  active={isActive}
                  tint={annotation.color}
                  iconOverride={
                    shapeKind === "step" ? (
                      <StepMarkerIcon
                        active={isActive}
                        color={annotation.color}
                      />
                    ) : shapeKind && shapeKind !== "blur" ? (
                      <LineStylePreview
                        style="solid"
                        kind={shapeKind}
                        active={isActive}
                      />
                    ) : undefined
                  }
                  onClick={() => {
                    setAnnotation({
                      mode: t.id,
                      ...(shapeKind && shapeKind !== "blur" && !activeShapeKind
                        ? { color: lastShapeColorRef.current }
                        : {}),
                    })
                  }}
                />
              )
            })}
          </ToolGroup>

          {annotation.mode === "blur" ? (
            <>
              <Divider />
              <div className="flex items-center gap-0.5 px-1">
                {REDACTION_TEMPLATES.map((template) => {
                  const isActive = activeRedactionEffect === template.id
                  return (
                    <Tooltip key={template.id}>
                      <TooltipTrigger asChild>
                        <button
                          aria-label={template.label}
                          className={cn(
                            "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                            isActive && "bg-accent text-foreground"
                          )}
                          onClick={() => {
                            setAnnotation({
                              mode: "blur",
                              blurEffect: template.id,
                            })
                          }}
                        >
                          <RedactionTemplatePreview
                            effect={template.id}
                            active={isActive}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {template.label}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </>
          ) : null}

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
                    showThicknessInColorPicker ? (
                      <ShapeThicknessPanel
                        value={annotation.strokeWidth}
                        color={annotation.color}
                        onChange={(strokeWidth) =>
                          setAnnotation({ strokeWidth })
                        }
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
                      <TooltipContent side="top">
                        Intensity {w}px
                      </TooltipContent>
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
                onClick={() => clearAnnotations()}
                aria-label="Clear all annotations"
                className="group inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <RiDeleteBin6Line className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Clear all</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

const Divider = ToolbarDivider

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
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 overflow-visible", strokeColor)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "arrow" ? (
        <>
          <path d="m12 19-7-7 7-7" strokeDasharray={dashArray} />
          <path d="M19 12H5" strokeDasharray={dashArray} />
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
      <ElasticSlider
        label="Intensity"
        value={value}
        min={1}
        max={32}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
        className="[--elastic-slider-fill-active:var(--annotation-color)] [--elastic-slider-fill:var(--annotation-color)] [--elastic-slider-handle:var(--annotation-color)]"
        style={{ "--annotation-color": color } as React.CSSProperties}
        onValueChange={(next) => {
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
    <ToolbarPopover
      tooltip={`Custom ${lowerLabel}`}
      contentClassName="w-56 p-3"
      trigger={({ open }) => (
        <button
          aria-label={`Custom ${lowerLabel}`}
          className={cn(
            "relative inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent",
            open && "bg-accent"
          )}
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
      )}
    >
      <ElasticSlider
        label={label}
        value={value}
        min={1}
        max={32}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
        onValueChange={(next) => {
          if (typeof next === "number") onChange(next)
        }}
      />
    </ToolbarPopover>
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

function RedactionTemplatePreview({
  effect,
  active,
}: {
  effect: AnnotationBlurEffect
  active: boolean
}) {
  const tone = active ? "bg-foreground" : "bg-foreground/55"

  if (effect === "blur") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border border-foreground/10 bg-foreground/35",
          active ? "opacity-100" : "opacity-70"
        )}
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.38), rgba(255,255,255,0.04))",
        }}
      />
    )
  }

  if (effect === "redact-stripe") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border-2 border-current",
          active ? "text-foreground" : "text-foreground/55"
        )}
        style={{
          background:
            "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px)",
        }}
      />
    )
  }

  if (effect === "pixelate") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border-2 border-current",
          active ? "text-foreground" : "text-foreground/55"
        )}
        style={{
          backgroundColor: "transparent",
          backgroundImage:
            "linear-gradient(45deg, currentColor 25%, transparent 25%), linear-gradient(-45deg, currentColor 25%, transparent 25%), linear-gradient(45deg, transparent 75%, currentColor 75%), linear-gradient(-45deg, transparent 75%, currentColor 75%)",
          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
          backgroundSize: "8px 8px",
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn("size-4 rounded-[3px] border border-foreground/10", tone)}
    />
  )
}

function annotationModeToShapeKind(
  mode: AnnotationMode
): AnnotationShapeKind | null {
  if (
    mode === "arrow" ||
    mode === "rect" ||
    mode === "ellipse" ||
    mode === "blur" ||
    mode === "step"
  ) {
    return mode
  }
  return null
}

function StepMarkerIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn(
        "size-5",
        active ? "text-foreground" : "text-foreground/55"
      )}
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8.5"
        fill={active ? color : "transparent"}
        stroke={active ? color : "currentColor"}
        strokeWidth="1.5"
      />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill={active ? "white" : "currentColor"}
      >
        1
      </text>
    </svg>
  )
}

function lineDashArray(style: AnnotationLineStyle) {
  if (style === "dashed") return "5 3"
  if (style === "dotted") return "2.2 2.2"
  return undefined
}
