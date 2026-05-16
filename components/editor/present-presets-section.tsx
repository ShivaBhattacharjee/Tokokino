"use client"

import * as React from "react"
import { RiCheckLine } from "@remixicon/react"
import { animate } from "motion/react"

import { AnnotationShapeElement } from "@/components/editor/annotation-shape-element"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import { CanvasBackdrop } from "@/components/editor/canvas/canvas-backdrop"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import { frameSelectionRadius, annotationPath } from "@/components/editor/canvas/helpers"
import { ScreenshotFrameContent } from "@/components/editor/canvas/screenshot-frame-content"
import {
  PRESENT_PRESETS,
  resolvePresentPresetScale,
  type PresentPreset,
} from "@/lib/editor/present-presets"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import {
  assetFilterCss,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  shadowCss,
  shadowDropFilterCss,
  screenshotPositionAnchor,
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  useSelectedScreenshotSlot,
  type AspectState,
  type CanvasState,
  type ScreenshotSlot,
  type Tilt,
  ScreenshotPosition,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

function isSameTilt(a: Tilt, b: Tilt) {
  return a.rx === b.rx && a.ry === b.ry && a.rz === b.rz
}

function transformFromTiltAndScale(tilt: Tilt, scale: number) {
  return [
    "perspective(1400px)",
    `rotateX(${tilt.rx}deg)`,
    `rotateY(${tilt.ry}deg)`,
    `rotateZ(${tilt.rz}deg)`,
    `scale(${scale / 100})`,
  ].join(" ")
}

type PresetMotionKind = "canvas" | "slot"

const PRESET_MOTION_MS = 560

function motionVarName(
  kind: PresetMotionKind,
  axis: "rx" | "ry" | "rz" | "scale"
) {
  return `--${kind}-ts-${axis}`
}

function setMotionVars(
  el: HTMLElement,
  kind: PresetMotionKind,
  tilt: Tilt,
  scale: number
) {
  el.style.setProperty(motionVarName(kind, "rx"), `${tilt.rx}deg`)
  el.style.setProperty(motionVarName(kind, "ry"), `${tilt.ry}deg`)
  el.style.setProperty(motionVarName(kind, "rz"), `${tilt.rz}deg`)
  el.style.setProperty(motionVarName(kind, "scale"), String(scale / 100))
}

function clearMotionVars(el: HTMLElement, kind: PresetMotionKind) {
  el.style.removeProperty(motionVarName(kind, "rx"))
  el.style.removeProperty(motionVarName(kind, "ry"))
  el.style.removeProperty(motionVarName(kind, "rz"))
  el.style.removeProperty(motionVarName(kind, "scale"))
}

function mixNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function overshootNumber(from: number, to: number, amount: number) {
  const delta = to - from
  if (Math.abs(delta) < 0.001) return to
  return to + delta * amount
}

function startPresetMotion({
  target,
  kind,
  fromTilt,
  fromScale,
  toTilt,
  toScale,
}: {
  target: HTMLElement | null
  kind: PresetMotionKind
  fromTilt: Tilt
  fromScale: number
  toTilt: Tilt
  toScale: number
}) {
  if (!target) return () => undefined

  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  if (media.matches) return () => undefined

  const peakTilt: Tilt = {
    rx: overshootNumber(fromTilt.rx, toTilt.rx, 0.16),
    ry: overshootNumber(fromTilt.ry, toTilt.ry, 0.16),
    rz: overshootNumber(fromTilt.rz, toTilt.rz, 0.16),
  }
  const peakScale = overshootNumber(fromScale, toScale, 0.12)
  setMotionVars(target, kind, fromTilt, fromScale)

  const controls = animate(0, 1, {
    duration: PRESET_MOTION_MS / 1000,
    ease: [0.16, 1, 0.3, 1],
    onUpdate: (value) => {
      const firstLeg = value < 0.68
      const legProgress = firstLeg ? value / 0.68 : (value - 0.68) / 0.32
      const startTilt = firstLeg ? fromTilt : peakTilt
      const endTilt = firstLeg ? peakTilt : toTilt
      const startScale = firstLeg ? fromScale : peakScale
      const endScale = firstLeg ? peakScale : toScale

      setMotionVars(
        target,
        kind,
        {
          rx: mixNumber(startTilt.rx, endTilt.rx, legProgress),
          ry: mixNumber(startTilt.ry, endTilt.ry, legProgress),
          rz: mixNumber(startTilt.rz, endTilt.rz, legProgress),
        },
        mixNumber(startScale, endScale, legProgress)
      )
    },
  })

  const cleanupTimer = window.setTimeout(() => {
    clearMotionVars(target, kind)
  }, PRESET_MOTION_MS + 80)

  return () => {
    controls.stop()
    window.clearTimeout(cleanupTimer)
    clearMotionVars(target, kind)
  }
}

function useContainScale(
  ref: React.RefObject<HTMLElement | null>,
  width: number,
  height: number
) {
  const [scale, setScale] = React.useState(0.1)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setScale(Math.min(rect.width / width, rect.height / height))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [height, ref, width])

  return scale
}

export function PresentPresetsSection() {
  const canvas = useActiveCanvasField((c) => c)
  const activeCanvasId = useActiveCanvasId()
  const aspect = useEditorStore((s) => s.present.aspect)
  const selectedSlot = useSelectedScreenshotSlot()
  const setTiltAndScale = useEditorStore((s) => s.setTiltAndScale)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const activeTilt = selectedSlot?.tilt ?? canvas.tilt
  const activeScale = selectedSlot?.scale ?? canvas.scale
  const activeFrame = selectedSlot?.frame ?? canvas.frame
  const presetMotionCleanupRef = React.useRef<(() => void) | null>(null)

  const applyPreset = React.useCallback(
    (preset: PresentPreset) => {
      const scale = resolvePresentPresetScale(preset, activeFrame)
      presetMotionCleanupRef.current?.()
      const target =
        typeof document === "undefined"
          ? null
          : activeCanvasId
            ? document.querySelector<HTMLElement>(
                `[data-canvas-id="${activeCanvasId}"]`
              )
            : null
      presetMotionCleanupRef.current = startPresetMotion({
        target,
        kind: "canvas",
        fromTilt: activeTilt,
        fromScale: activeScale,
        toTilt: preset.tilt,
        toScale: scale,
      })
      setTiltAndScale(preset.tilt, scale)
      for (const slot of canvas.screenshotSlots) {
        const slotScale = resolvePresentPresetScale(preset, slot.frame)
        updateScreenshotSlot(slot.id, { tilt: preset.tilt, scale: slotScale })
      }
    },
    [
      activeCanvasId,
      activeFrame,
      activeScale,
      activeTilt,
      canvas.screenshotSlots,
      setTiltAndScale,
      updateScreenshotSlot,
    ]
  )

  React.useEffect(() => {
    return () => presetMotionCleanupRef.current?.()
  }, [])

  return (
    <div className="space-y-2">
      {PRESENT_PRESETS.map((preset) => {
        const scale = resolvePresentPresetScale(preset, activeFrame)
        const active =
          activeScale === scale && isSameTilt(activeTilt, preset.tilt)

        return (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={preset.name}
            onClick={() => applyPreset(preset)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              applyPreset(preset)
            }}
            className={cn(
              "group w-full cursor-pointer overflow-hidden rounded-[8px] border bg-white/[0.045] p-2 text-left transition-colors",
              active
                ? "border-primary ring-1 ring-primary/40"
                : "border-white/12 hover:border-primary/55"
            )}
          >
            <div
              aria-hidden
              inert
              className="relative h-[176px] overflow-hidden rounded-[6px] isolate [&_*]:pointer-events-none"
            >
              <PresentPresetPreview
                aspect={aspect}
                canvas={canvas}
                preset={preset}
                selectedSlot={selectedSlot}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] leading-tight font-medium">
                  {preset.name}
                </p>
              </div>
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-white transition-opacity",
                  active
                    ? "border-primary/70 bg-primary/20 text-black dark:text-primary-foreground opacity-100"
                    : "border-white/25 opacity-0 group-hover:opacity-70"
                )}
                aria-hidden
              >
                <RiCheckLine className="size-3" />
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PresentPresetPreview({
  aspect,
  canvas,
  preset,
  selectedSlot,
}: {
  aspect: AspectState
  canvas: CanvasState
  preset: PresentPreset
  selectedSlot: ScreenshotSlot | null
}) {
  const previewRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const nullCanvasRef = React.useRef<HTMLDivElement>(null)
  const effectsFilter = effectsFilterCss(canvas.backdrop.effects)
  const noiseEnabled = canvas.backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? canvas.backdrop.effects.noise / 100 : 0
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const canvasAspectRatio = aw / ah
  const stageWidth = BASE_CANVAS_WIDTH
  const stageHeight = (BASE_CANVAS_WIDTH * ah) / aw
  const previewScale = useContainScale(previewRef, stageWidth, stageHeight)
  const inRowMode = canvas.screenshotSlots.length > 0
  const rowLayoutItems = React.useMemo(
    () =>
      inRowMode
        ? computeRowLayout(
            [
              { id: "__main__", frame: canvas.frame },
              ...canvas.screenshotSlots.map((slot) => ({
                id: slot.id,
                frame: slot.frame,
              })),
            ],
            canvasAspectRatio
          )
        : null,
    [canvas.frame, canvas.screenshotSlots, canvasAspectRatio, inRowMode]
  )
  const mainRowLayout = rowLayoutItems ? rowLayoutItems[0] : null
  const screenshotAnchor = screenshotPositionAnchor(canvas.screenshotPosition)
  const slotRowLayoutById = React.useMemo(() => {
    if (!rowLayoutItems) return null
    const map = new Map<string, { widthPct: number; xPct: number }>()
    for (const item of rowLayoutItems.slice(1)) {
      map.set(item.id, { widthPct: item.widthPct, xPct: item.xPct })
    }
    return map
  }, [rowLayoutItems])
  const canvasTransform = transformFromTiltAndScale(
    preset.tilt,
    resolvePresentPresetScale(preset, canvas.frame)
  )

  return (
    <div ref={previewRef} className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden [contain:paint] ring-1 ring-white/10"
        style={{
          width: stageWidth,
          height: stageHeight,
          borderRadius: canvas.canvasBorderRadius,
          transform: `translate(-50%, -50%) scale(${previewScale})`,
          transformOrigin: "center",
        }}
      >
        <CanvasBackdrop
          background={canvas.background}
          backdrop={canvas.backdrop}
          effectsFilter={effectsFilter}
          noiseEnabled={noiseEnabled}
          noiseOpacity={noiseOpacity}
          portrait={canvas.portrait}
          overlay={canvas.overlay}
        />
        {mainRowLayout ? (
          <PresentMainScreenshot
            canvas={canvas}
            transform={canvasTransform}
            screenshotOffset={canvas.screenshotOffset}
            screenshotPosition={canvas.screenshotPosition}
            screenshotAnchor={screenshotAnchor}
            stageRef={stageRef}
            imageRef={imageRef}
            canvasAspectRatio={canvasAspectRatio}
            rowLayout={mainRowLayout}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: `${(canvas.padding / 1200) * 100}%` }}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <CanvasFrameContent
                canvas={canvas}
                contentTransform={canvasTransform}
                screenshotAnchor={screenshotAnchor}
                screenshotOffset={canvas.screenshotOffset}
                stageRef={stageRef}
                imageRef={imageRef}
              />
            </div>
          </div>
        )}
        {canvas.screenshotSlots.map((slot) => (
          <PresentSlot
            key={slot.id}
            slot={slot}
            canvasAspectRatio={canvasAspectRatio}
            rowLayout={slotRowLayoutById?.get(slot.id) ?? null}
            previewTilt={preset.tilt}
            previewScale={resolvePresentPresetScale(preset, slot.frame)}
          />
        ))}
        {canvas.assets.map((a) => (
          <AssetElementView key={a.id} asset={a} canvasRef={nullCanvasRef} previewMode />
        ))}
        {canvas.texts.map((t) => (
          <TextElementView key={t.id} text={t} canvasRef={nullCanvasRef} previewMode />
        ))}
        {[...canvas.annotationShapes]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((shape) => (
            <AnnotationShapeElement
              key={shape.id}
              shape={shape}
              canvasRef={nullCanvasRef}
              previewMode
            />
          ))}
        {canvas.annotations
          .filter((s) => s.mode !== "eraser" && !s.hidden)
          .map((stroke) => (
            <svg
              key={stroke.id}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{
                zIndex: 60 + (stroke.zIndex ?? 0),
                mixBlendMode:
                  stroke.blendMode ??
                  (stroke.mode === "highlight" ? "multiply" : "normal"),
              }}
            >
              <path
                d={annotationPath(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={
                  ((stroke.opacity ?? 100) / 100) *
                  (stroke.mode === "highlight" ? 0.42 : 1)
                }
              />
            </svg>
          ))}
        {canvas.overlay.id !== null && canvas.overlay.position === "overlay" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${overlayUrl(canvas.overlay.id)}")`,
              opacity: canvas.overlay.opacity / 100,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function PresentMainScreenshot({
  canvas,
  transform,
  screenshotOffset,
  screenshotPosition,
  screenshotAnchor,
  stageRef,
  imageRef,
  canvasAspectRatio,
  rowLayout,
}: {
  canvas: CanvasState
  transform: string
  screenshotOffset: { x: number; y: number }
  screenshotPosition: ScreenshotPosition
  screenshotAnchor: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  canvasAspectRatio: number
  rowLayout: { widthPct: number; xPct: number }
}) {
  const left =
    screenshotPosition === "center"
      ? `${rowLayout.xPct}%`
      : `${screenshotAnchor.x}%`
  const top =
    screenshotPosition === "center" ? "50%" : `${screenshotAnchor.y}%`
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width: `${rowLayout.widthPct}%`,
        aspectRatio: slotBoxAspectRatio(canvas.frame, canvasAspectRatio),
        transform: `translate(-50%, -50%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px)`,
        zIndex: 60 + canvas.screenshotLayer.zIndex,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          padding: `${Math.max(0, Math.min(240, canvas.padding)) / 12}%`,
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            opacity: canvas.screenshotLayer.hidden
              ? 0
              : canvas.screenshotLayer.opacity / 100,
            mixBlendMode:
              canvas.screenshotLayer.blendMode !== "normal"
                ? canvas.screenshotLayer.blendMode
                : undefined,
            borderRadius: frameSelectionRadius(
              canvas.frame.id,
              canvas.borderRadius
            ),
          }}
        >
          <CanvasFrameContent
            canvas={canvas}
            contentTransform={transform}
            stageRef={stageRef}
            imageRef={imageRef}
          />
        </div>
      </div>
    </div>
  )
}

function CanvasFrameContent({
  canvas,
  contentTransform,
  screenshotAnchor,
  screenshotOffset,
  stageRef,
  imageRef,
}: {
  canvas: CanvasState
  contentTransform: string
  screenshotAnchor?: { x: number; y: number }
  screenshotOffset?: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
}) {
  const enhanceFilter = enhanceFilterCss(canvas.enhance)
  const bareStyle: React.CSSProperties = {
    borderRadius: canvas.borderRadius,
    boxShadow: shadowCss(canvas.shadow),
    filter: enhanceFilter,
    transform: contentTransform,
    transformStyle: "preserve-3d",
  }
  if (canvas.border.color && canvas.border.width > 0) {
    bareStyle.outline = `${canvas.border.width}px ${canvas.border.style || "solid"} ${canvas.border.color}`
    bareStyle.outlineOffset = `${canvas.border.padding || 0}px`
  }

  return (
    <ScreenshotFrameContent
      src={canvas.screenshot}
      frame={canvas.frame}
      isDragOver={false}
      onBrowse={() => undefined}
      imageFilter={enhanceFilter}
      shadowFilter={shadowDropFilterCss(canvas.shadow)}
      contentTransform={contentTransform}
      bareStyle={bareStyle}
      activeTool="pointer"
      isDragging={false}
      stageRef={stageRef}
      imageRef={imageRef}
      addressValue={canvas.frameAddress}
      onAddressChange={() => undefined}
      onSelect={(e) => e.stopPropagation()}
      onPointerDown={() => undefined}
      onPointerMove={() => undefined}
      onPointerUp={() => undefined}
      onImageLoad={() => undefined}
      onCrop={() => undefined}
      onReplaceFile={() => undefined}
      onDelete={() => undefined}
      screenshotAnchor={screenshotAnchor}
      screenshotOffset={screenshotOffset}
      applyTransformWhenEmpty
    />
  )
}

function PresentSlot({
  slot,
  canvasAspectRatio,
  rowLayout,
  previewTilt,
  previewScale,
}: {
  slot: ScreenshotSlot
  canvasAspectRatio: number
  rowLayout: { widthPct: number; xPct: number } | null
  previewTilt?: Tilt
  previewScale?: number
}) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const effectiveWidthPct = rowLayout?.widthPct ?? slot.widthPct
  const filterChain = [
    enhanceFilterCss(slot.enhance),
    assetFilterCss(slot.filter),
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
  const bareStyle: React.CSSProperties = {
    borderRadius: slot.borderRadius,
    boxShadow: shadowCss(slot.shadow),
    filter: filterChain || undefined,
  }
  if (slot.border.color && slot.border.width > 0) {
    bareStyle.outline = `${slot.border.width}px ${slot.border.style || "solid"} ${slot.border.color}`
    bareStyle.outlineOffset = `${slot.border.padding || 0}px`
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${slot.xPct}%`,
        top: `${slot.yPct}%`,
        width: `${effectiveWidthPct}%`,
        aspectRatio: slotBoxAspectRatio(slot.frame, canvasAspectRatio),
        transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
        zIndex: 60 + slot.zIndex,
        display: slot.hidden ? "none" : undefined,
        mixBlendMode: slot.blendMode !== "normal" ? slot.blendMode : undefined,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ padding: `${Math.max(0, Math.min(240, slot.padding)) / 12}%` }}
      >
        <div
          className="relative h-full w-full"
          style={{
            opacity: slot.opacity / 100,
            borderRadius: frameSelectionRadius(
              slot.frame.id,
              slot.borderRadius
            ),
          }}
        >
          <ScreenshotFrameContent
            src={slot.src}
            frame={slot.frame}
            isDragOver={false}
            onBrowse={() => undefined}
            imageFilter={filterChain || undefined}
            shadowFilter={shadowDropFilterCss(slot.shadow)}
            contentTransform={transformFromTiltAndScale(
              previewTilt ?? slot.tilt,
              previewScale ?? slot.scale
            )}
            bareStyle={{
              ...bareStyle,
              transform: transformFromTiltAndScale(
                previewTilt ?? slot.tilt,
                previewScale ?? slot.scale
              ),
              transformStyle: "preserve-3d",
            }}
            activeTool="pointer"
            isDragging={false}
            stageRef={stageRef}
            imageRef={imageRef}
            addressValue={slot.frameAddress}
            onAddressChange={() => undefined}
            onSelect={(e) => e.stopPropagation()}
            onPointerDown={() => undefined}
            onPointerMove={() => undefined}
            onPointerUp={() => undefined}
            onImageLoad={() => undefined}
            onCrop={() => undefined}
            onReplaceFile={() => undefined}
            onDelete={() => undefined}
            applyTransformWhenEmpty
          />
        </div>
      </div>
    </div>
  )
}
