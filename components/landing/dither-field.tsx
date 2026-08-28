"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

const BAYER_8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

const FRAME_MS = 1000 / 20

function readRgb(el: HTMLElement, variable: string): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim()
  if (!raw) return [233, 57, 84]

  // The palette is authored in oklch, which canvas cannot parse. Painting the
  // value onto a 1x1 context is the cheapest way to resolve it to sRGB.
  const probe = document.createElement("canvas")
  probe.width = 1
  probe.height = 1
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  if (!ctx) return [233, 57, 84]
  ctx.fillStyle = raw
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/**
 * Ordered-dither field: a Bayer-thresholded falloff rendered at one pixel per
 * cell on an offscreen buffer, then scaled up with smoothing off. Drawing the
 * cells individually would cost tens of thousands of fillRect calls a frame.
 */
export function DitherField({
  className,
  cell = 6,
  speed = 0.35,
  intensity = 1,
}: {
  className?: string
  cell?: number
  speed?: number
  intensity?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const buffer = document.createElement("canvas")
    const bufferCtx = buffer.getContext("2d")
    if (!bufferCtx) return

    const [r, g, b] = readRgb(canvas, "--primary")
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let image: ImageData | null = null
    let frame = 0
    let last = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      cols = Math.max(1, Math.ceil(width / cell))
      rows = Math.max(1, Math.ceil(height / cell))
      canvas.width = width
      canvas.height = height
      buffer.width = cols
      buffer.height = rows
      image = bufferCtx.createImageData(cols, rows)
      ctx.imageSmoothingEnabled = false
    }

    const paint = (time: number) => {
      if (!image) return
      const data = image.data
      const lastCol = Math.max(1, cols - 1)
      const lastRow = Math.max(1, rows - 1)

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Density grows toward the right edge and the bottom, so the field
          // reads as a corner bleed rather than a halo around the copy.
          const corner = Math.max(x / lastCol, y / lastRow)
          const wave =
            Math.sin(x * 0.07 + time) * 0.05 + Math.cos(y * 0.09 - time) * 0.05
          const value = (corner - 0.46) * 1.9 + wave

          const threshold = BAYER_8x8[y & 7][x & 7] / 64
          const index = (y * cols + x) * 4
          const on = value > threshold

          data[index] = r
          data[index + 1] = g
          data[index + 2] = b
          data[index + 3] = on ? Math.round(255 * intensity) : 0
        }
      }

      bufferCtx.putImageData(image, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(buffer, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell)
    }

    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        paint((now / 1000) * speed)
      }
      frame = requestAnimationFrame(tick)
    }

    resize()

    if (reduceMotion) {
      paint(0)
    } else {
      frame = requestAnimationFrame(tick)
    }

    const observer = new ResizeObserver(() => {
      resize()
      paint(reduceMotion ? 0 : (performance.now() / 1000) * speed)
    })
    observer.observe(canvas)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [cell, speed, intensity])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none size-full", className)}
    />
  )
}
