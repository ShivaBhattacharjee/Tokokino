"use client"

import * as React from "react"
import { RiImage2Line } from "@remixicon/react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { cn } from "@/lib/utils"
import {
  backgroundCss,
  effectsFilterCss,
  overlayUrl,
  patternCssFor,
  shadowCss,
  useEditor,
} from "@/lib/editor/store"

const NOISE_DATA_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/></svg>\")"

export function Canvas() {
  const {
    screenshot,
    aspect,
    background,
    padding,
    borderRadius,
    border,
    backdrop,
    tilt,
    scale,
    shadow,
    overlay,
    canvasBorderRadius,
    setScreenshot,
  } = useEditor()
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [naturalDims, setNaturalDims] = React.useState<{
    w: number
    h: number
  } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  const computedShadow = shadowCss(shadow)
  const imgStyle: React.CSSProperties = {
    borderRadius,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: computedShadow,
  }
  if (border.color && border.width > 0) {
    imgStyle.outline = `${border.width}px solid ${border.color}`
    imgStyle.outlineOffset = "0px"
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0

  return (
    <section className="relative flex flex-1 items-center justify-center border-b border-dashed border-border/70 bg-background px-4 py-4 sm:px-8 dark:bg-black">
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

      <motion.div
        initial={{ opacity: 0, scale: 0.985, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ aspectRatio, borderRadius: canvasBorderRadius }}
        className={cn(
          "relative flex w-full max-w-[1100px] items-center justify-center overflow-hidden ring-1 ring-border/60",
          ah > aw && "max-w-[min(70vh,720px)]"
        )}
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

        {/* Content */}
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ padding }}
        >
          {screenshot ? (
            <img
              src={screenshot}
              alt="Screenshot"
              onLoad={(e) => {
                const el = e.currentTarget
                setNaturalDims({
                  w: el.naturalWidth,
                  h: el.naturalHeight,
                })
              }}
              style={imgStyle}
              className="max-h-full max-w-full object-contain transition-transform"
            />
          ) : (
            <div
              data-drag-over={isDragOver}
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-foreground/25 bg-background/60 text-center backdrop-blur-sm transition-colors",
                "data-[drag-over=true]:border-foreground/60 data-[drag-over=true]:bg-foreground/10"
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm">
                <RiImage2Line className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[14px] font-medium">Drop a screenshot</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  or{" "}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                  >
                    browse
                  </button>{" "}
                  · paste with{" "}
                  <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border px-1 font-mono text-[10px]">
                    ⌘V
                  </kbd>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Overlay (above everything in the canvas) */}
        {overlay.id !== null && overlay.position === "overlay" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${overlayUrl(overlay.id)}")`,
              opacity: overlay.opacity / 100,
            }}
          />
        ) : null}
      </motion.div>
    </section>
  )
}
