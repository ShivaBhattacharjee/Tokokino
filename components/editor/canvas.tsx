"use client"

import * as React from "react"
import { RiAddLine, RiGlobeLine, RiSettings4Line, RiCameraLine, RiCropLine, RiDeleteBinLine, RiRefreshLine } from "@remixicon/react"
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
    setScreenshotOffset,
    setScreenshotPosition,
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
  const [centerGuides, setCenterGuides] = React.useState({
    x: false,
    y: false,
  })
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const suppressTransitionRef = React.useRef(false)
  const [, forceRender] = React.useState(0)
  const prevPaddingRef = React.useRef(padding)
  React.useEffect(() => {
    if (prevPaddingRef.current !== padding) {
      prevPaddingRef.current = padding
      suppressTransitionRef.current = true
      forceRender((n) => n + 1)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressTransitionRef.current = false
          forceRender((n) => n + 1)
        })
      })
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
    imgStyle.outlineOffset = "0px"
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
      "relative z-0 flex flex-1 items-center justify-center overflow-hidden bg-background dark:bg-black transition-all duration-300",
      isPreviewMode ? "p-0" : "border-b border-dashed border-border/70 px-4 py-4 sm:px-8"
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

          {/* Background layer — receives filter effects */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0",
              background.type === "none" && "bg-transparency-checker"
            )}
            style={{
              ...backgroundCss(background),
              filter: effectsFilter,
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
          style={{ padding, zIndex: 20 }}
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
                  isScreenshotDragging || suppressTransitionRef.current
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
                    isScreenshotDragging || suppressTransitionRef.current
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
                "pointer-events-auto relative flex h-full w-full flex-col items-center justify-center gap-6 text-center transition-all duration-300",
                "text-white/90",
                "data-[drag-over=true]:scale-[1.02]"
              )}
            >
              <div 
                className="flex flex-col items-center gap-5 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <RiAddLine className="size-20 font-light text-white/70 stroke-[0.5]" />
                <h3 className="text-xl font-medium tracking-wide drop-shadow-sm">Drag & drop, click to browse, or paste</h3>
                
                <div className="flex items-center gap-2 text-white/80">
                  <kbd className="inline-flex h-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2.5 font-mono text-sm backdrop-blur-md shadow-sm">
                    ⌘ V
                  </kbd>
                  <span className="text-base">to paste</span>
                </div>
              </div>

              <div className="flex w-full max-w-xs items-center gap-4 py-2">
                <div className="h-px flex-1 bg-white/20"></div>
                <span className="text-sm text-white/50">or</span>
                <div className="h-px flex-1 bg-white/20"></div>
              </div>

              <div className="flex w-full max-w-[380px] flex-col items-stretch gap-3">
                <div className="flex h-[52px] w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-colors hover:bg-white/15 focus-within:bg-white/20 focus-within:border-white/30">
                  <RiGlobeLine className="size-5 text-white/60" />
                  <input 
                    type="text" 
                    placeholder="Enter website URL..." 
                    className="flex-1 bg-transparent text-base text-white placeholder:text-white/60 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex w-full gap-3">
                  <button 
                    className="group flex h-[52px] flex-1 gap-2.5 px-6 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all hover:bg-white/20 hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(255,255,255,0.1)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RiCameraLine className="size-5 text-white/80 transition-transform group-hover:scale-110" />
                    <span className="text-white font-medium tracking-wide">Capture Screenshot</span>
                  </button>
                  <button 
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all hover:bg-white/20 hover:scale-[1.02]"
                    onClick={(e) => e.stopPropagation()}
                    title="Settings"
                  >
                    <RiSettings4Line className="size-5 text-white/80 transition-transform hover:rotate-90" />
                  </button>
                </div>
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
          <TextElementView key={t.id} text={t} canvasRef={canvasRef} />
        ))}
      </motion.div>
      </div>

      <CropModal
        open={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        screenshotUrl={screenshot}
        onCrop={setScreenshot}
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
