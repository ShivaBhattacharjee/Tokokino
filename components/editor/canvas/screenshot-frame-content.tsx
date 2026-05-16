"use client"

import * as React from "react"

import { isBrowserFrame, resolveBrowserFrameColor } from "@/lib/browser-frame"
import type {
  DeviceFrame,
  EditorTool,
  ScreenshotLayer,
} from "@/lib/editor/store"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"

import { BoxEmptyState } from "./box-empty-state"
import { MockupEmptyState } from "./mockup-empty-state"
import { deviceMockupSpec, framePositionTransform } from "./helpers"
import { ScreenshotBare } from "./screenshot-bare"
import {
  BrowserFrameEmptyState,
  ScreenshotBrowserFrame,
} from "./screenshot-browser-frame"
import { ScreenshotMockup } from "./screenshot-mockup"

type ScreenshotFrameContentProps = {
  src: string | null
  frame: DeviceFrame
  isDragOver: boolean
  onBrowse: () => void
  imageFilter?: string
  shadowFilter?: string
  bareStyle?: React.CSSProperties
  activeTool: EditorTool
  isDragging: boolean
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  addressValue: string
  onAddressChange: (value: string) => void
  onSelect: (e: { stopPropagation: () => void }) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onCrop: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  contentTransform?: string
  screenshotOffset?: { x: number; y: number }
  screenshotAnchor?: { x: number; y: number }
  /** Keep transform in the empty-state container (needed for preset previews) */
  applyTransformWhenEmpty?: boolean
  /** Show a compact icon trigger instead of the full upload card */
  emptyCompact?: boolean
}

const CENTER_ANCHOR = { x: 50, y: 50 }
const ZERO_OFFSET = { x: 0, y: 0 }
const CONTENT_LAYER: ScreenshotLayer = {
  zIndex: 1,
  opacity: 100,
  blendMode: "normal",
  hidden: false,
}

function emptyBareStyle(style?: React.CSSProperties) {
  if (!style) return undefined
  const { transform, transformStyle, ...rest } = style
  void transform
  void transformStyle
  return rest
}

export function ScreenshotFrameContent({
  src,
  frame,
  isDragOver,
  onBrowse,
  imageFilter,
  shadowFilter,
  bareStyle,
  activeTool,
  isDragging,
  stageRef,
  imageRef,
  addressValue,
  onAddressChange,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  onCrop,
  onReplaceFile,
  onDelete,
  contentTransform = "",
  screenshotOffset = ZERO_OFFSET,
  screenshotAnchor = CENTER_ANCHOR,
  applyTransformWhenEmpty = false,
  emptyCompact = false,
}: ScreenshotFrameContentProps) {
  const browserFrame = isBrowserFrame(frame.id)
  const browserFrameColor = resolveBrowserFrameColor(frame.color)
  const mockupDevice =
    frame.id === "none" || browserFrame ? null : getDeviceMockup(frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const mockupRotation =
    frame.orientation === "horizontal" && mockupOrientation === "portrait"
      ? -90
      : 0
  const mockupAsset =
    frame.id === "none" || browserFrame
      ? null
      : getDeviceMockupAsset(frame.id, frame.color, mockupOrientation)
  const mockupSpec = mockupAsset ? deviceMockupSpec(frame.id) : null
  const handleImageLoad = onImageLoad ?? (() => undefined)

  if (src) {
    if (browserFrame) {
      return (
        <ScreenshotBrowserFrame
          screenshot={src}
          frameId={frame.id}
          color={browserFrameColor}
          screenshotLayer={CONTENT_LAYER}
          transform={contentTransform}
          shadowFilter={shadowFilter}
          screenshotOffset={screenshotOffset}
          screenshotAnchor={screenshotAnchor}
          enhanceFilter={imageFilter}
          isScreenshotDragging={isDragging}
          activeTool={activeTool}
          stageRef={stageRef}
          imageRef={imageRef}
          addressValue={addressValue}
          onAddressChange={onAddressChange}
          onSelect={onSelect}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onImageLoad={handleImageLoad}
          onCropClick={onCrop}
          onReplaceFile={onReplaceFile}
          onDelete={onDelete}
          showHoverActions={false}
        />
      )
    }

    if (mockupAsset && mockupSpec) {
      return (
        <ScreenshotMockup
          screenshot={src}
          mockupAsset={mockupAsset}
          mockupSpec={mockupSpec}
          screenshotLayer={CONTENT_LAYER}
          transform={contentTransform}
          mockupRotation={mockupRotation}
          shadowFilter={shadowFilter}
          screenshotOffset={screenshotOffset}
          screenshotAnchor={screenshotAnchor}
          enhanceFilter={imageFilter}
          isScreenshotDragging={isDragging}
          activeTool={activeTool}
          placementDims={null}
          stageRef={stageRef}
          imageRef={imageRef}
          onSelect={onSelect}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onImageLoad={handleImageLoad}
          onCropClick={onCrop}
          onReplaceFile={onReplaceFile}
          onDelete={onDelete}
          showHoverActions={false}
        />
      )
    }

    return (
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-full w-full"
        style={{
          transform: framePositionTransform({
            anchor: screenshotAnchor,
            offset: screenshotOffset,
            transform: "",
          }),
          transformOrigin: "center",
        }}
      >
        <ScreenshotBare
          screenshot={src}
          imgStyle={bareStyle ?? {}}
          positionedStyle={null}
          transform={contentTransform}
          screenshotLeft={undefined}
          screenshotTop={undefined}
          placementDims={null}
          screenshotLayer={CONTENT_LAYER}
          isScreenshotSelected={false}
          isScreenshotDragging={isDragging}
          suppressTransition={false}
          activeTool={activeTool}
          selectedTextId={null}
          stageRef={stageRef}
          imageRef={imageRef}
          shadowBoxTarget={frame.id === "none"}
          onContainerPointerDown={() => undefined}
          onSelect={onSelect}
          onPointerDown={(e) => onPointerDown(e)}
          onPointerMove={(e) => onPointerMove(e)}
          onPointerUp={(e) => onPointerUp(e)}
          onImageLoad={handleImageLoad}
          onCropClick={onCrop}
          onReplaceFile={onReplaceFile}
          onDelete={onDelete}
        />
      </div>
    )
  }

  if (browserFrame) {
    return (
      <BrowserFrameEmptyState
        frameId={frame.id}
        color={browserFrameColor}
        isDragOver={isDragOver}
        onBrowse={onBrowse}
        transform={contentTransform}
        shadowFilter={shadowFilter}
        enhanceFilter={imageFilter}
        screenshotOffset={screenshotOffset}
        screenshotAnchor={screenshotAnchor}
        isScreenshotDragging={isDragging}
        activeTool={activeTool}
        addressValue={addressValue}
        onAddressChange={onAddressChange}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        compact={emptyCompact}
      />
    )
  }

  if (mockupAsset && mockupSpec) {
    return (
      <MockupEmptyState
        compact={emptyCompact}
        mockupAsset={mockupAsset}
        mockupSpec={mockupSpec}
        isDragOver={isDragOver}
        onBrowse={onBrowse}
        transform={contentTransform}
        shadowFilter={shadowFilter}
        enhanceFilter={imageFilter}
        mockupRotation={mockupRotation}
        screenshotOffset={screenshotOffset}
        screenshotAnchor={screenshotAnchor}
        isScreenshotDragging={isDragging}
        activeTool={activeTool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    )
  }

  return (
    <div
      data-editor-shadow-box-target={frame.id === "none" ? "" : undefined}
      className={`relative h-full w-full overflow-hidden${
        applyTransformWhenEmpty
          ? " transition-transform duration-300 ease-out"
          : ""
      }`}
      style={applyTransformWhenEmpty ? bareStyle : emptyBareStyle(bareStyle)}
    >
      <BoxEmptyState
        isDragOver={isDragOver}
        onBrowse={onBrowse}
        compact={emptyCompact}
      />
    </div>
  )
}
