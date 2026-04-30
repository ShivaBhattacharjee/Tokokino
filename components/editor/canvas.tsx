"use client"

import * as React from "react"
import {
  RiAddLine,
  RiGlobeLine,
  RiCameraLine,
  RiCropLine,
  RiDeleteBinLine,
  RiRefreshLine,
} from "@remixicon/react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { CropModal } from "@/components/editor/crop-modal"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import { cn } from "@/lib/utils"
import {
  backgroundCss,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  patternCssFor,
  shadowCss,
  screenshotPositionAnchor,
  assetFilterCss,
  useEditor,
} from "@/lib/editor/store"

const NOISE_DATA_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/></svg>\")"

function portraitOverlayCss(
  mode: import("@/lib/editor/store").PortraitMode,
  intensity: number
): React.CSSProperties | null {
  if (mode === "off") return null
  const t = Math.max(0, Math.min(100, intensity)) / 100
  switch (mode) {
    case "soft":
      return {
        background: `radial-gradient(ellipse at center, transparent ${40 + t * 10}%, rgba(0,0,0,${0.45 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    case "studio":
      return {
        background: `radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, transparent ${20 + t * 10}%, rgba(0,0,0,${0.85 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    case "spot":
      return {
        background: `radial-gradient(circle at 50% 45%, rgba(255,255,255,${0.18 * t}) 0%, transparent ${25 + t * 15}%), radial-gradient(circle at 50% 45%, transparent ${30 + t * 10}%, rgba(0,0,0,${0.7 * t}) 100%)`,
        mixBlendMode: "normal",
      }
    case "frame":
      return {
        boxShadow: `inset 0 0 ${80 * t}px ${30 * t}px rgba(0,0,0,${0.7 * t})`,
        background: "transparent",
      }
    case "iris":
      return {
        background: `radial-gradient(circle at 50% 50%, transparent ${35 + t * 15}%, rgba(0,0,0,${0.55 * t}) ${55 + t * 10}%, rgba(0,0,0,${0.95 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    default:
      return null
  }
}

export function Canvas() {
  const {
    activeTool,
    screenshot,
    originalScreenshot,
    lastCropRegion,
    aspect,
    background,
    padding,
    borderRadius,
    border,
    backdrop,
    tilt,
    scale,
    canvasZoom,
    screenshotPosition,
    screenshotOffset,
    shadow,
    overlay,
    portrait,
    enhance,
    canvasBorderRadius,
    isPreviewMode,
    setScreenshot,
    applyCroppedScreenshot,
    setScreenshotOffset,
    texts,
    selectedTextId,
    setSelectedTextId,
    assets,
    setSelectedAssetId,
  } = useEditor()
  const canvasRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!selectedTextId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTextId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedTextId, setSelectedTextId])
  React.useEffect(() => {
    document.documentElement.style.setProperty("--canvas-border-radius", `${canvasBorderRadius}px`)
  }, [canvasBorderRadius])

  const [isDragOver, setIsDragOver] = React.useState(false)
  const [naturalDims, setNaturalDims] = React.useState<{
    w: number
    h: number
  } | null>(null)
  const [placementDims, setPlacementDims] = React.useState<{
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  } | null>(null)
  const [isScreenshotSelected, setIsScreenshotSelected] = React.useState(false)
  const [isScreenshotDragging, setIsScreenshotDragging] = React.useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false)
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const [centerGuides, setCenterGuides] = React.useState({ x: false, y: false })
  const [textCenterGuides, setTextCenterGuides] = React.useState({ x: false, y: false })
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [suppressTransition, setSuppressTransition] = React.useState(false)
  const prevPaddingRef = React.useRef(padding)
  React.useEffect(() => {
    if (prevPaddingRef.current === padding) return

    prevPaddingRef.current = padding
    setSuppressTransition(true)
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setSuppressTransition(false)
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [padding])
  const dragRef = React.useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
    baseLeft: number
    baseTop: number
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  } | null>(null)

  const measurePlacement = React.useCallback(() => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    const next = {
      stageW: stage.clientWidth,
      stageH: stage.clientHeight,
      imgW: image.offsetWidth,
      imgH: image.offsetHeight,
    }

    if (!next.stageW || !next.stageH || !next.imgW || !next.imgH) return

    setPlacementDims((prev) => {
      if (
        prev?.stageW === next.stageW &&
        prev.stageH === next.stageH &&
        prev.imgW === next.imgW &&
        prev.imgH === next.imgH
      ) {
        return prev
      }
      return next
    })
  }, [])

  React.useEffect(() => {
    if (!screenshot) return
    measurePlacement()

    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    const observer = new ResizeObserver(measurePlacement)
    observer.observe(stage)
    observer.observe(image)
    return () => observer.disconnect()
  }, [measurePlacement, screenshot])

  const readFile = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshot(reader.result)
          setNaturalDims(null)
        }
      }
      reader.readAsDataURL(file)
    },
    [setScreenshot]
  )

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            readFile(file)
            e.preventDefault()
            break
          }
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [readFile])

  const isAuto = aspect.id === "auto" || aspect.w === 0 || aspect.h === 0
  const autoDims = isAuto && naturalDims ? naturalDims : null
  const aw = autoDims ? autoDims.w : aspect.w || 16
  const ah = autoDims ? autoDims.h : aspect.h || 10
  const aspectRatio = `${aw} / ${ah}`

  const transform = [
    `perspective(1400px)`,
    `rotateX(${tilt.rx}deg)`,
    `rotateY(${tilt.ry}deg)`,
    `rotateZ(${tilt.rz}deg)`,
    `scale(${scale / 100})`,
  ].join(" ")
  const screenshotAnchor = screenshotPositionAnchor(screenshotPosition)

  // For portrait ratios, cap width so the canvas never overflows vertically.
  // Formula: maxWidth = (availableVh * aw/ah) where availableVh ≈ 82vh
  const isPortrait = ah > aw
  const canvasMaxWidth = isPreviewMode
    ? `min(95vw, calc(90vh * ${aw} / ${ah}))`
    : isPortrait
      ? `min(${Math.round(82 * aw / ah)}vh, ${Math.round(820 * aw / ah)}px)`
      : "1100px"

  const computedShadow = shadowCss(shadow)
  const scaleFactor = scale / 100
  const positionX = screenshotAnchor.x / 100
  const positionY = screenshotAnchor.y / 100
  const positionedStyle: React.CSSProperties | null = placementDims
    ? screenshotPlacementStyle(
        placementDims,
        scaleFactor,
        positionX,
        positionY
      )
    : null
  const screenshotLeft =
    typeof positionedStyle?.left === "number"
      ? positionedStyle.left + screenshotOffset.x
      : undefined
  const screenshotTop =
    typeof positionedStyle?.top === "number"
      ? positionedStyle.top + screenshotOffset.y
      : undefined
  const enhanceFilter = enhanceFilterCss(enhance)
  const imgStyle: React.CSSProperties = {
    borderRadius,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: computedShadow,
    filter: enhanceFilter,
  }
  if (border.color && border.width > 0) {
    imgStyle.outline = `${border.width}px ${border.style || "solid"} ${border.color}`
    imgStyle.outlineOffset = `${border.padding || 0}px`
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  const canDragScreenshot = activeTool === "pointer" && positionedStyle

  const startScreenshotDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!canDragScreenshot || !placementDims) return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsScreenshotSelected(true)
    setIsScreenshotDragging(true)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: screenshotOffset.x,
      startOffsetY: screenshotOffset.y,
      baseLeft: positionedStyle.left as number,
      baseTop: positionedStyle.top as number,
      stageW: placementDims.stageW,
      stageH: placementDims.stageH,
      imgW: placementDims.imgW,
      imgH: placementDims.imgH,
    }
  }

  const moveScreenshot = (e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    e.preventDefault()

    const pointerScale = canvasZoom / 100
    let nextX =
      drag.startOffsetX + (e.clientX - drag.startClientX) / pointerScale
    let nextY =
      drag.startOffsetY + (e.clientY - drag.startClientY) / pointerScale
    const centerX = drag.baseLeft + nextX + drag.imgW / 2
    const centerY = drag.baseTop + nextY + drag.imgH / 2
    const targetX = drag.stageW / 2
    const targetY = drag.stageH / 2
    const snap = 8
    const snapX = Math.abs(centerX - targetX) <= snap
    const snapY = Math.abs(centerY - targetY) <= snap

    if (snapX) nextX += targetX - centerX
    if (snapY) nextY += targetY - centerY

    setCenterGuides({ x: snapX, y: snapY })
    setScreenshotOffset({ x: nextX, y: nextY })
  }

  const stopScreenshotDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    dragRef.current = null
    setIsScreenshotDragging(false)
    setCenterGuides({ x: false, y: false })
  }

  return (
    <section className={cn(
      "relative z-0 flex flex-1 justify-center overflow-hidden bg-background dark:bg-black transition-all duration-300",
      isPreviewMode
        ? "items-center p-0"
        : "items-start border-b border-dashed border-border/70 px-2 pt-2 pb-20 sm:px-4 sm:pt-3 sm:pb-20 lg:items-center lg:px-8 lg:pt-4 lg:pb-20"
    )}>
      <CornerMarkers className="text-border" size={12} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) readFile(f)
          e.target.value = ""
        }}
      />

      <div
        className="flex w-full items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: `scale(${isPreviewMode ? 1 : canvasZoom / 100})` }}
      >
        <motion.div
          ref={canvasRef}
          initial={{ opacity: 0, scale: 0.985, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ aspectRatio, borderRadius: "var(--canvas-border-radius)", maxWidth: canvasMaxWidth }}
          className="relative flex w-full items-center justify-center overflow-hidden ring-1 ring-border/60"
          onClick={() => {
            setSelectedTextId(null)
            setSelectedAssetId(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) readFile(file)
          }}
        >
          {centerGuides.x ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 z-30 -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {centerGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.x ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 z-50 -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-50 -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
            />
          ) : null}

          {/* Background layer — receives filter effects */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0",
              background.type === "none" && "bg-transparency-checker"
            )}
            style={{
              ...backgroundCss(background),
              filter: [effectsFilter, assetFilterCss(backdrop.filter ?? "none")].filter(Boolean).join(" ") || undefined,
            }}
          />

        {/* Pattern overlays */}
        {backdrop.pattern.ids.map((id) => (
          <div
            key={id}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              ...patternCssFor(
                id,
                backdrop.pattern.color,
                backdrop.pattern.thickness
              ),
              opacity: backdrop.pattern.intensity / 100,
            }}
          />
        ))}

        {/* Noise overlay */}
        {noiseEnabled ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{ backgroundImage: NOISE_DATA_URL, opacity: noiseOpacity }}
          />
        ) : null}

        {/* Portrait mode (vignette/spotlight) — sits above background, below screenshot */}
        {(() => {
          const portraitStyle = portraitOverlayCss(portrait.mode, portrait.intensity)
          if (!portraitStyle) return null
          return (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={portraitStyle}
            />
          )
        })()}

        {/* Underlay (above background, below screenshot) */}
        {overlay.id !== null && overlay.position === "underlay" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${overlayUrl(overlay.id)}")`,
              opacity: overlay.opacity / 100,
            }}
          />
        ) : null}

        {/* Content — wrapper itself is click-through so text layered behind the screenshot can still receive clicks; the image + interactive children opt back in via pointer-events-auto */}
        <div
          className="pointer-events-none relative flex h-full w-full items-center justify-center"
          style={{ padding: screenshot ? padding : 0, zIndex: 20 }}
        >
          {screenshot ? (
            <div
              ref={stageRef}
              className="pointer-events-none relative h-full w-full group/screenshot"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setIsScreenshotSelected(false)
                }
              }}
            >
              <img
                ref={imageRef}
                src={screenshot}
                alt="Screenshot"
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget
                  setNaturalDims({
                    w: el.naturalWidth,
                    h: el.naturalHeight,
                  })
                  measurePlacement()
                }}
                onClick={(e) => {
                  if (activeTool !== "pointer") return
                  e.stopPropagation()
                  setIsScreenshotSelected(true)
                  setSelectedTextId(null)
                }}
                onPointerDown={(e) => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  setSelectedTextId(null)
                  startScreenshotDrag(e)
                }}
                onPointerMove={moveScreenshot}
                onPointerUp={stopScreenshotDrag}
                onPointerCancel={stopScreenshotDrag}
                style={{
                  ...imgStyle,
                  left: screenshotLeft ?? "50%",
                  top: screenshotTop ?? "50%",
                  ...(positionedStyle
                    ? null
                    : {
                        transform: `translate(-50%, -50%) ${transform}`,
                      }),
                }}
                className={cn(
                  "pointer-events-auto absolute max-h-full max-w-full object-contain select-none",
                  isScreenshotDragging || suppressTransition
                    ? "cursor-grabbing transition-none"
                    : "transition-all duration-300 ease-out",
                  activeTool === "pointer" && "cursor-grab",
                  isScreenshotSelected &&
                    activeTool === "pointer" &&
                    "ring-2 ring-blue-400/90"
                )}
              />
              
              {/* Hover Actions — tracks image center, hidden during text editing */}
              {activeTool === "pointer" && placementDims && !selectedTextId && (
                <div
                  className={cn(
                    "pointer-events-none absolute z-50 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover/screenshot:opacity-100",
                    isScreenshotDragging || suppressTransition
                      ? "transition-none"
                      : "transition-[opacity,left,top] duration-300 ease-out"
                  )}
                  style={{
                    left: (screenshotLeft ?? placementDims.stageW / 2 - placementDims.imgW / 2) + placementDims.imgW / 2,
                    top: (screenshotTop ?? placementDims.stageH / 2 - placementDims.imgH / 2) + placementDims.imgH / 2,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <input
                    ref={replaceInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const src = ev.target?.result
                        if (src) setScreenshot(src as string)
                      }
                      reader.readAsDataURL(file)
                      e.target.value = ""
                    }}
                  />
                  <button
                    onClick={() => setIsCropModalOpen(true)}
                    className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-black/90"
                    title="Crop image"
                  >
                    <RiCropLine className="size-5" />
                  </button>
                  <button
                    onClick={() => replaceInputRef.current?.click()}
                    className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-black/90"
                    title="Replace image"
                  >
                    <RiRefreshLine className="size-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-red-500/90"
                    title="Delete image"
                  >
                    <RiDeleteBinLine className="size-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              data-drag-over={isDragOver}
              className={cn(
                "pointer-events-auto relative flex h-full w-full flex-col items-center justify-center px-4 py-3 text-center text-white transition-all duration-300 sm:px-6 md:px-8",
                "data-[drag-over=true]:scale-[1.01]"
              )}
            >
              <button
                type="button"
                className={cn(
                  "group relative flex w-full max-w-[520px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-white/24 bg-black/12 px-5 py-3.5 backdrop-blur-md transition-all duration-300 focus-visible:border-white/55 focus-visible:ring-2 focus-visible:ring-white/20 sm:max-w-[540px] sm:rounded-[1.75rem] sm:px-7 sm:py-5 md:min-h-[190px] md:max-w-[560px] md:px-9 md:py-7",
                  "hover:border-white/42 hover:bg-black/18",
                  "data-[drag-over=true]:border-primary/80 data-[drag-over=true]:bg-primary/10 data-[drag-over=true]:ring-1 data-[drag-over=true]:ring-primary/40"
                )}
                data-drag-over={isDragOver}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Browse for an image"
              >
                <span className="mb-2 grid size-8 place-items-center rounded-full border border-white/18 bg-white/10 text-white/78 transition-colors group-hover:bg-white/14 group-hover:text-white sm:size-10 md:mb-3 md:size-11">
                  <RiAddLine className="size-5 sm:size-7 md:size-8" />
                </span>
                <span className="space-y-1 sm:space-y-1.5 md:space-y-2">
                  <span className="block text-balance text-xl font-medium leading-none tracking-[-0.055em] text-white sm:text-2xl md:text-3xl">
                    Add your screenshot
                  </span>
                  <span className="block text-[10px] leading-4 text-white/56 sm:text-xs sm:leading-5 md:text-sm">
                    Drop an image here, click to browse, or paste from clipboard.
                  </span>
                </span>

                <span className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/18 px-2.5 py-1 text-[10px] text-white/58 sm:text-[11px] md:mt-4 md:text-xs">
                  <kbd className="font-mono text-white/78">⌘V</kbd>
                  paste
                </span>
              </button>

              <div className="my-2 flex w-full max-w-[400px] items-center gap-4 sm:my-3 md:my-4">
                <div className="h-px flex-1 bg-white/16" />
                <span className="text-xs text-white/42">or</span>
                <div className="h-px flex-1 bg-white/16" />
              </div>

              <div className="flex w-full max-w-[520px] gap-2 rounded-[1.15rem] border border-white/14 bg-black/14 p-1.5 backdrop-blur-md transition-colors focus-within:border-white/30 sm:max-w-[540px] sm:rounded-[1.35rem] sm:p-2 md:max-w-[560px]">
                <label className="flex min-h-10 flex-1 items-center gap-2.5 rounded-[0.9rem] px-3 text-left sm:min-h-11 sm:rounded-[1rem] md:min-h-12 md:rounded-[1.1rem]">
                  <RiGlobeLine className="size-4 shrink-0 text-white/50 sm:size-5" />
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="Enter website URL..."
                    aria-label="Website URL"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/44 focus:outline-none sm:text-[15px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[0.9rem] border border-white/14 bg-white/14 px-3 text-[13px] font-semibold tracking-[-0.02em] text-white transition-colors hover:bg-white/20 active:bg-white/24 sm:min-h-11 sm:min-w-[112px] sm:rounded-[1rem] sm:px-4 md:min-h-12 md:min-w-[128px] md:rounded-[1.1rem] md:px-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RiCameraLine className="size-4" />
                  <span className="hidden sm:inline">Capture</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Overlay (above the screenshot, below front-layered text) */}
        {overlay.id !== null && overlay.position === "overlay" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${overlayUrl(overlay.id)}")`,
              opacity: overlay.opacity / 100,
              zIndex: 30,
            }}
          />
        ) : null}

        {/* Asset images */}
        {assets.map((a) => (
          <AssetElementView key={a.id} asset={a} canvasRef={canvasRef} />
        ))}

        {/* Text elements */}
        {texts.map((t) => (
          <TextElementView key={t.id} text={t} canvasRef={canvasRef} onCenterGuideChange={setTextCenterGuides} />
        ))}
      </motion.div>
      </div>

      <CropModal
        open={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        screenshotUrl={originalScreenshot ?? screenshot}
        initialRegion={lastCropRegion}
        onCrop={applyCroppedScreenshot}
      />
    </section>
  )
}

function screenshotPlacementStyle(
  dims: {
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  },
  scaleFactor: number,
  positionX: number,
  positionY: number
): React.CSSProperties {
  const visualW = dims.imgW * scaleFactor
  const visualH = dims.imgH * scaleFactor
  const overflowX = Math.min(visualW * 0.18, dims.stageW * 0.24)
  const overflowY = Math.min(visualH * 0.18, dims.stageH * 0.24)

  const visualLeft =
    -overflowX + (dims.stageW - visualW + overflowX * 2) * positionX
  const visualTop =
    -overflowY + (dims.stageH - visualH + overflowY * 2) * positionY

  return {
    left: visualLeft + (visualW - dims.imgW) / 2,
    top: visualTop + (visualH - dims.imgH) / 2,
  }
}
