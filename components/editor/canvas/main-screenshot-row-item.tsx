"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiFullscreenLine, RiSmartphoneLine } from "@remixicon/react"

import { ScreenshotFrameSettings } from "@/components/editor/canvas/screenshot-edit-menu"
import { ImageFitPicker } from "@/components/editor/toolbar/image-fit-picker"
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
import type { CaptureDevice, CaptureSettings } from "./upload-card"

/**
 * Pure presentational core. Both the interactive row item and the preset
 * preview render through this so the visual output stays in lockstep.
 *
 * In `previewMode`:
 *  - pointer events are off
 *  - the floating pencil edit menu is not mounted
 *  - selection outline is suppressed (the caller is expected to pass
 *    `isSelected={false}` anyway)
 */
type MainScreenshotRenderProps = {
  containerRef?: React.Ref<HTMLDivElement>
  style: React.CSSProperties
  offset: { x: number; y: number }
  padding: number
  transform: string
  screenshot: string | null
  frame: DeviceFrame
  addressValue: string
  onAddressChange: (value: string) => void
  imgStyle: React.CSSProperties
  shadowFilter: string | undefined
  filterChain: string | undefined
  objectFit: "contain" | "cover" | "fill"
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  isDragOver: boolean
  isSelected: boolean
  isScreenshotDragging: boolean
  bulkCanvasDragging: boolean
  activeTool: EditorTool
  editOpen: boolean
  onEditOpenChange: (open: boolean) => void
  onSelect: (e: { stopPropagation: () => void }) => void
  onBrowse: () => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  previewMode?: boolean
  emptyCompact?: boolean
  innerLightingStyle?: React.CSSProperties | null
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
}

export function MainScreenshotRender({
  containerRef,
  style,
  offset,
  padding,
  transform,
  screenshot,
  frame,
  addressValue,
  onAddressChange,
  imgStyle,
  shadowFilter,
  filterChain,
  objectFit,
  stageRef,
  imageRef,
  isDragOver,
  isSelected,
  isScreenshotDragging,
  bulkCanvasDragging,
  activeTool,
  editOpen,
  onEditOpenChange,
  onSelect,
  onBrowse,
  onCropClick,
  onReplaceFile,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  previewMode = false,
  emptyCompact = false,
  innerLightingStyle,
  onCapture,
  captureDefaultDevice,
  captureStateKey,
}: MainScreenshotRenderProps) {
  const baseTransform = style.transform ?? ""
  const mergedStyle: React.CSSProperties = {
    ...style,
    transform:
      `${baseTransform} translate(var(--editor-main-offset-x, ${offset.x}px), var(--editor-main-offset-y, ${offset.y}px))`.trim(),
  }
  const selectionRadius = frameSelectionRadius(
    frame.id,
    imgStyle.borderRadius as number
  )
  const contentStyle: React.CSSProperties = {
    padding: `var(--editor-padding-preview, ${Math.max(0, Math.min(240, padding)) / 12}%)`,
  }
  const showEditMenu = !previewMode && screenshot && activeTool === "pointer"
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={containerRef}
      data-box-hover-target={previewMode ? undefined : ""}
      data-editor-shadow-preview-scope="canvas"
      className={cn(
        "group/main-row",
        previewMode ? "pointer-events-none" : "pointer-events-auto",
        !previewMode && activeTool === "pointer" && "cursor-grab",
        !previewMode && isScreenshotDragging && "cursor-grabbing"
      )}
      style={mergedStyle}
      onClick={previewMode ? undefined : onSelect}
      onPointerDown={
        previewMode
          ? undefined
          : (e) => {
              if (activeTool !== "pointer") return
              e.stopPropagation()
              onPointerDown(e)
            }
      }
      onPointerMove={previewMode ? undefined : onPointerMove}
      onPointerUp={previewMode ? undefined : onPointerUp}
      onPointerCancel={previewMode ? undefined : onPointerUp}
    >
      <div className="absolute inset-0" style={contentStyle}>
        <div
          className="relative h-full w-full"
          style={{
            opacity: imgStyle.opacity as number | undefined,
            mixBlendMode: imgStyle.mixBlendMode,
            borderRadius: selectionRadius,
          }}
        >
          {isSelected && !previewMode ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
              style={{
                transform,
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
            suppressEmptyTransition
            emptyCompact={emptyCompact}
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
            innerLightingStyle={innerLightingStyle}
            onCapture={onCapture}
            captureDefaultDevice={captureDefaultDevice}
            captureStateKey={captureStateKey}
          />

          {showEditMenu ? (
            <div
              className={cn(
                "pointer-events-none absolute top-1/2 left-1/2 z-20 transition-opacity duration-200",
                editOpen || isSelected
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
                    onEditOpenChange(false)
                    return
                  }
                  onEditOpenChange(open)
                }}
                onCrop={onCropClick}
                onReplaceFile={onReplaceFile}
                onDelete={onDelete}
                onCaptureWebsite={onCapture}
                captureDefaultDevice={captureDefaultDevice}
                captureDefaultOrientation={frame.orientation}
                captureStateKey={captureStateKey}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

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
  toolbarScale: number
  activeTool: EditorTool
  isScreenshotDragging: boolean
  onSelect: (e: { stopPropagation: () => void }) => void
  onBrowse: () => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onDuplicate: () => void
  canDuplicate?: boolean
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
  previewMode?: boolean
  emptyCompact?: boolean
  innerLightingStyle?: React.CSSProperties | null
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
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
  canDuplicate = true,
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
  previewMode = false,
  emptyCompact = false,
  innerLightingStyle,
  onCapture,
  captureDefaultDevice,
  captureStateKey,
}: MainScreenshotRowItemProps) {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const { toolbarRect, hideFloatingToolbar, measureRect } =
    useFloatingToolbarRect({
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

  return (
    <>
      <MainScreenshotRender
        containerRef={rowRef}
        style={style}
        offset={offset}
        padding={padding}
        transform={transform}
        screenshot={screenshot}
        frame={frame}
        addressValue={addressValue}
        onAddressChange={onAddressChange}
        imgStyle={imgStyle}
        shadowFilter={shadowFilter}
        filterChain={filterChain}
        objectFit={objectFit}
        stageRef={stageRef}
        imageRef={imageRef}
        isDragOver={isDragOver}
        isSelected={isSelected}
        isScreenshotDragging={isScreenshotDragging}
        bulkCanvasDragging={bulkCanvasDragging}
        activeTool={activeTool}
        editOpen={editOpen}
        onEditOpenChange={setEditOpen}
        onSelect={onSelect}
        onBrowse={onBrowse}
        onCropClick={onCropClick}
        onReplaceFile={onReplaceFile}
        onDelete={onDelete}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onImageLoad={onImageLoad}
        previewMode={previewMode}
        emptyCompact={emptyCompact}
        innerLightingStyle={innerLightingStyle}
        onCapture={onCapture}
        captureDefaultDevice={captureDefaultDevice}
        captureStateKey={captureStateKey}
      />

      {isSelected &&
      !previewMode &&
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
                  className="pointer-events-none fixed z-40"
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
                      {canDuplicate && (
                        <>
                          <ToolbarDivider />
                          <ToolbarDuplicateButton
                            ariaLabel="Duplicate screenshot"
                            onDuplicate={onDuplicate}
                          />
                        </>
                      )}
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
                              <ToolbarButton
                                aria-label="Image fit"
                                active={open}
                              >
                                <RiFullscreenLine className="size-4" />
                              </ToolbarButton>
                            )}
                          >
                            <ImageFitPicker
                              value={objectFit}
                              onChange={onObjectFitChange}
                            />
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
