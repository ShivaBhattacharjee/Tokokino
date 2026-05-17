"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiFullscreenLine, RiSmartphoneLine } from "@remixicon/react"

import { ScreenshotFrameSettings } from "@/components/editor/canvas/screenshot-edit-menu"
import {
  floatingToolbarTransform,
  ToolbarButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  ToolbarPopover,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import type { DeviceFrame, EditorTool } from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { cn } from "@/lib/utils"

import { frameSelectionRadius } from "./helpers"
import { ScreenshotEditMenu } from "./screenshot-edit-menu"
import { ScreenshotFrameContent } from "./screenshot-frame-content"

type MainScreenshotRowItemProps = {
  style: React.CSSProperties
  offset: { x: number; y: number }
  screenshot: string | null
  frame: DeviceFrame
  addressValue: string
  onAddressChange: (value: string) => void
  padding: number
  transform: string
  isDragOver: boolean
  imgStyle: React.CSSProperties
  shadowFilter: string | undefined
  filterChain: string | undefined
  isSelected: boolean
  bulkCanvasDragging: boolean
  hoverActionsInline: boolean
  hoverActionsLayoutKey: string
  hoverActionsScale: number
  toolbarScale: number
  activeTool: EditorTool
  isScreenshotDragging: boolean
  onSelect: (e: { stopPropagation: () => void }) => void
  onBrowse: () => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onDuplicate: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onFrameChange: (frame: DeviceFrame) => void
  objectFit: "contain" | "cover" | "fill"
  onObjectFitChange: (fit: "contain" | "cover" | "fill") => void
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function MainScreenshotRowItem({
  style,
  offset,
  screenshot,
  frame,
  addressValue,
  onAddressChange,
  padding,
  transform,
  isDragOver,
  imgStyle,
  shadowFilter,
  filterChain,
  isSelected,
  bulkCanvasDragging,
  toolbarScale,
  activeTool,
  isScreenshotDragging,
  onSelect,
  onBrowse,
  onCropClick,
  onReplaceFile,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onFrameChange,
  objectFit,
  onObjectFitChange,
  stageRef,
  imageRef,
  onImageLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: MainScreenshotRowItemProps) {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const { toolbarRect, hideFloatingToolbar, measureRect } = useFloatingToolbarRect({
    elRef: rowRef,
    isSelected,
    bulkCanvasDragging,
    kind: "screenshot",
    elementId: null,
  })

  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected) return
    measureRect()
  }, [
    bulkCanvasDragging,
    isSelected,
    measureRect,
    offset.x,
    offset.y,
    style.left,
    style.top,
  ])

  const baseTransform = (style.transform) ?? ""
  const mergedStyle: React.CSSProperties = {
    ...style,
    transform:
      `${baseTransform} translate(${offset.x}px, ${offset.y}px)`.trim(),
    transition: isScreenshotDragging
      ? undefined
      : "left 300ms ease-out, top 300ms ease-out",
  }
  const selectionRadius = frameSelectionRadius(
    frame.id,
    imgStyle.borderRadius as number
  )
  const contentStyle: React.CSSProperties = {
    padding: `${Math.max(0, Math.min(240, padding)) / 12}%`,
  }
  return (
    <>
      <div
        ref={rowRef}
        data-box-hover-target
        data-editor-shadow-preview-scope="canvas"
        className={cn(
          "group/main-row pointer-events-auto",
          activeTool === "pointer" && "cursor-grab",
          isScreenshotDragging && "cursor-grabbing"
        )}
        style={mergedStyle}
        onClick={onSelect}
        onPointerDown={(e) => {
          if (activeTool !== "pointer") return
          e.stopPropagation()
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-0" style={contentStyle}>
          <div
            className="relative h-full w-full"
            style={{
              opacity: imgStyle.opacity as number | undefined,
              mixBlendMode:
                imgStyle.mixBlendMode,
              borderRadius: selectionRadius,
            }}
          >
            {isSelected ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
                style={{
                  transform: transform,
                  transformStyle: "preserve-3d",
                  borderRadius: selectionRadius,
                }}
              />
            ) : null}
            <ScreenshotFrameContent
              src={screenshot}
              frame={frame}
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              imageFilter={filterChain}
              shadowFilter={shadowFilter}
              contentTransform={transform}
              bareStyle={imgStyle}
              applyTransformWhenEmpty
              emptyCompact
              objectFit={objectFit}
              activeTool={activeTool}
              isDragging={isScreenshotDragging}
              stageRef={stageRef}
              imageRef={imageRef}
              addressValue={addressValue}
              onAddressChange={onAddressChange}
              onSelect={onSelect}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onImageLoad={onImageLoad}
              onCrop={onCropClick}
              onReplaceFile={onReplaceFile}
              onDelete={onDelete}
            />

            {screenshot && activeTool === "pointer" ? (
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 left-1/2 z-20 transition-opacity duration-200",
                  editOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover/main-row:opacity-100",
                  (bulkCanvasDragging || isScreenshotDragging) &&
                    !editOpen &&
                    "!opacity-0"
                )}
                style={{
                  transform: `translate(-50%, -50%) ${transform}`,
                  transformOrigin: "center",
                  transformStyle: "preserve-3d",
                }}
              >
                <ScreenshotEditMenu
                  open={editOpen}
                  onOpenChange={(open) => {
                    if (bulkCanvasDragging || isScreenshotDragging) {
                      setEditOpen(false)
                      return
                    }
                    setEditOpen(open)
                  }}
                  onCrop={onCropClick}
                  onReplaceFile={onReplaceFile}
                  onDelete={onDelete}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isSelected &&
      !bulkCanvasDragging &&
      !hideFloatingToolbar &&
      toolbarRect &&
      typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              return (
                <div
                  data-editor-floating-toolbar-target="main-screenshot"
                  data-export-hidden="true"
                  className="pointer-events-none fixed z-100"
                  style={{
                    top,
                    left,
                    transform: floatingToolbarTransform(
                      flipBelow,
                      toolbarScale
                    ),
                    transformOrigin: flipBelow ? "top center" : "bottom center",
                  }}
                >
                  <div className="pointer-events-auto">
                    <ToolbarSurface>
                      <ToolbarDragHandle
                        ariaLabel="Drag screenshot"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onPointerDown(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }}
                        onPointerMove={(e) =>
                          onPointerMove(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }
                        onPointerUp={(e) =>
                          onPointerUp(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }
                      />
                      <ToolbarDivider />
                      <ToolbarDuplicateButton
                        ariaLabel="Duplicate screenshot"
                        onDuplicate={onDuplicate}
                      />
                      <ToolbarPopover
                        tooltip="Frame"
                        contentClassName="w-64 p-2"
                        trigger={({ open }) => (
                          <ToolbarButton aria-label="Frame" active={open}>
                            <RiSmartphoneLine className="size-4" />
                          </ToolbarButton>
                        )}
                      >
                        <ScreenshotFrameSettings
                          frame={frame}
                          onFrameChange={onFrameChange}
                        />
                      </ToolbarPopover>
                      {screenshot && (
                        <>
                          <ToolbarDivider />
                          <ToolbarPopover
                            tooltip="Image fit"
                            contentClassName="w-56 p-2"
                            trigger={({ open }) => (
                              <ToolbarButton aria-label="Image fit" active={open}>
                                <RiFullscreenLine className="size-4" />
                              </ToolbarButton>
                            )}
                          >
                            <div className="flex flex-col gap-2">
                              <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                                Image Fit
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {([
                                  {
                                    value: "contain" as const,
                                    label: "Contain",
                                    icon: (
                                      <svg viewBox="0 0 32 32" className="size-full" fill="none">
                                        <rect x="2" y="2" width="28" height="28" rx="3" className="stroke-current opacity-30" strokeWidth="1.5" strokeDasharray="3 2" />
                                        <rect x="7" y="5" width="18" height="22" rx="2" className="fill-current opacity-25" />
                                        <rect x="7" y="5" width="18" height="22" rx="2" className="stroke-current" strokeWidth="1.5" />
                                      </svg>
                                    ),
                                  },
                                  {
                                    value: "cover" as const,
                                    label: "Cover",
                                    icon: (
                                      <svg viewBox="0 0 32 32" className="size-full" fill="none">
                                        <rect x="2" y="2" width="28" height="28" rx="3" className="stroke-current opacity-30" strokeWidth="1.5" strokeDasharray="3 2" />
                                        <rect x="2" y="2" width="28" height="28" rx="3" className="fill-current opacity-25" />
                                        <rect x="-2" y="4" width="36" height="24" rx="2" className="stroke-current" strokeWidth="1.5" />
                                      </svg>
                                    ),
                                  },
                                  {
                                    value: "fill" as const,
                                    label: "Fill",
                                    icon: (
                                      <svg viewBox="0 0 32 32" className="size-full" fill="none">
                                        <rect x="2" y="2" width="28" height="28" rx="3" className="fill-current opacity-25" />
                                        <rect x="2" y="2" width="28" height="28" rx="3" className="stroke-current" strokeWidth="1.5" />
                                        <path d="M8 8L5 5M24 8l3-3M8 24l-3 3M24 24l3 3" className="stroke-current opacity-50" strokeWidth="1.5" strokeLinecap="round" />
                                      </svg>
                                    ),
                                  },
                                ]).map(({ value, label, icon }) => (
                                  <button
                                    key={value}
                                    onClick={() => onObjectFitChange(value)}
                                    className={cn(
                                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-[11px] transition-all",
                                      objectFit === value
                                        ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                                    )}
                                  >
                                    <span className="size-7">{icon}</span>
                                    <span className="font-medium">{label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </ToolbarPopover>
                        </>
                      )}
                      <ToolbarLayerOrderMenu
                        onBringToFront={onBringToFront}
                        onSendToBack={onSendToBack}
                      />
                    </ToolbarSurface>
                  </div>
                </div>
              )
            })(),
            document.body
          )
        : null}
    </>
  )
}
