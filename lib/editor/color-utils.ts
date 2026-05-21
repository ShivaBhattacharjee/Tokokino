import type { Background } from "./state-types"

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace("#", "")
  if (c.length === 3) {
    return {
      r: parseInt(c[0] + c[0], 16),
      g: parseInt(c[1] + c[1], 16),
      b: parseInt(c[2] + c[2], 16),
    }
  }
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  }
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const c = hex.replace("#", "")
  let r: number, g: number, b: number
  if (c.length === 3) {
    r = parseInt(c[0] + c[0], 16) / 255
    g = parseInt(c[1] + c[1], 16) / 255
    b = parseInt(c[2] + c[2], 16) / 255
  } else if (c.length === 6 || c.length === 8) {
    r = parseInt(c.slice(0, 2), 16) / 255
    g = parseInt(c.slice(2, 4), 16) / 255
    b = parseInt(c.slice(4, 6), 16) / 255
  } else {
    return null
  }
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

const NEUTRAL_PATTERN_COLORS = ["#F5F5F4", "#D6D3D1", "#A8A29E"]

export function dynamicPatternColors(bg: Background): string[] {
  if (bg.type === "image" || bg.type === "none") return NEUTRAL_PATTERN_COLORS
  const matches = bg.value.match(/#[0-9a-fA-F]{3,8}/g) ?? []
  const muted: string[] = []
  for (const hex of matches) {
    const hsl = hexToHsl(hex)
    if (!hsl) continue
    const sat = Math.min(28, hsl.s * 0.45)
    const lightness = hsl.l < 50 ? 78 : 82
    const swatch = `hsl(${Math.round(hsl.h)} ${Math.round(sat)}% ${lightness}%)`
    if (!muted.includes(swatch)) muted.push(swatch)
  }
  if (!muted.length) return NEUTRAL_PATTERN_COLORS
  if (muted.length === 1) return [muted[0], NEUTRAL_PATTERN_COLORS[0]]
  return muted.slice(0, 3)
}

type Rgb = { r: number; g: number; b: number }

const dominantColorCache = new Map<string, Rgb[]>()

function isSameOriginUrl(url: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function readableImageUrl(url: string): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url
  if (isSameOriginUrl(url)) return url

  try {
    const parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) return url
    return `/api/export/image?url=${encodeURIComponent(url)}`
  } catch {
    return url
  }
}

async function extractDominantRgb(url: string, max: number): Promise<Rgb[]> {
  const cached = dominantColorCache.get(url)
  if (cached && cached.length >= max) return cached.slice(0, max)
  const result = await new Promise<Rgb[]>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const size = 64
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const buckets = new Map<string, Rgb & { n: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          if (a < 128) continue
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`
          const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
          bucket.r += r
          bucket.g += g
          bucket.b += b
          bucket.n += 1
          buckets.set(key, bucket)
        }
        const sorted = [...buckets.values()]
          .sort((a, b) => b.n - a.n)
          .map(({ r, g, b, n }) => ({ r: r / n, g: g / n, b: b / n }))
        const picked: Rgb[] = []
        for (const c of sorted) {
          const distinct = picked.every(
            (p) =>
              Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) >
              60
          )
          if (distinct) {
            picked.push(c)
            if (picked.length >= max) break
          }
        }
        resolve(picked)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = readableImageUrl(url)
  })
  dominantColorCache.set(url, result)
  return result
}

function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  )
}

function muteRgb(r: number, g: number, b: number): string {
  const hex = rgbToHex({ r, g, b })
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const sat = Math.min(28, hsl.s * 0.45)
  const lightness = hsl.l < 50 ? 78 : 82
  return `hsl(${Math.round(hsl.h)} ${Math.round(sat)}% ${lightness}%)`
}

export async function sampleImageColors(
  url: string,
  max = 3
): Promise<string[]> {
  const picked = await extractDominantRgb(url, max)
  return picked.map(({ r, g, b }) => muteRgb(r, g, b))
}

export async function sampleImageColorsRaw(
  url: string,
  max = 6
): Promise<string[]> {
  const picked = await extractDominantRgb(url, max)
  return picked.map(rgbToHex)
}

export function generateAutoGradients(colors: string[], max = 100): string[] {
  if (colors.length < 2) return []
  const out: string[] = []
  const angles = [0, 45, 90, 135, 180, 225, 270, 315]
  const pairs: [string, string][] = []
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      pairs.push([colors[i], colors[j]])
    }
  }
  for (const angle of angles) {
    for (const [a, b] of pairs) {
      out.push(`linear-gradient(${angle}deg, ${a}, ${b})`)
      if (out.length >= max) return out
    }
  }
  for (let i = 0; i < colors.length; i++) {
    for (let j = 0; j < colors.length; j++) {
      if (i === j) continue
      for (let k = 0; k < colors.length; k++) {
        if (k === i || k === j) continue
        out.push(
          `linear-gradient(135deg, ${colors[i]}, ${colors[j]}, ${colors[k]})`
        )
        if (out.length >= max) return out
      }
    }
  }
  for (const [a, b] of pairs) {
    out.push(`radial-gradient(circle at 30% 30%, ${a}, ${b})`)
    if (out.length >= max) return out
  }
  return out
}

function srgbChannel(c: number): number {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  )
}

function parseCssRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(/rgba?\(([^)]+)\)/i)
  if (!m) return null
  const parts = m[1].split(",").map((p) => p.trim())
  if (parts.length < 3) return null
  const r = Number(parts[0])
  const g = Number(parts[1])
  const b = Number(parts[2])
  const a = parts[3] !== undefined ? Number(parts[3]) : 1
  if (![r, g, b, a].every((n) => Number.isFinite(n))) return null
  return { r, g, b, a }
}

function hexLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return relativeLuminance(r, g, b)
}

const imageLuminanceCache = new Map<string, number>()

async function imageAverageLuminance(url: string): Promise<number> {
  const cached = imageLuminanceCache.get(url)
  if (cached !== undefined) return cached
  const result = await new Promise<number>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let sum = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          sum += relativeLuminance(data[i], data[i + 1], data[i + 2])
          count++
        }
        resolve(count ? sum / count : 0.5)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = readableImageUrl(url)
  })
  imageLuminanceCache.set(url, result)
  return result
}

export async function pickContrastColor(
  screenshot: string | null,
  background: Background
): Promise<string> {
  let lum: number | null = null
  if (background.type === "solid") {
    lum = hexLuminance(background.value)
  } else if (background.type === "gradient") {
    const matches = background.value.match(/#[0-9a-fA-F]{3,8}/g) ?? []
    if (matches.length) {
      lum = matches.reduce((s, h) => s + hexLuminance(h), 0) / matches.length
    }
  } else if (background.type === "image") {
    try {
      lum = await imageAverageLuminance(background.value)
    } catch {
      /* ignore */
    }
  }
  if (lum === null && screenshot) {
    try {
      lum = await imageAverageLuminance(screenshot)
    } catch {
      /* ignore */
    }
  }
  if (lum === null) return "#ffffff"
  return lum > 0.5 ? "#000000" : "#ffffff"
}

async function sampleImageLuminanceAtPoint(
  url: string,
  relX: number,
  relY: number,
  radius = 20
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const cx = Math.round(relX * img.naturalWidth)
        const cy = Math.round(relY * img.naturalHeight)
        const sx = Math.max(0, cx - radius)
        const sy = Math.max(0, cy - radius)
        const sw = Math.min(radius * 2, img.naturalWidth - sx)
        const sh = Math.min(radius * 2, img.naturalHeight - sy)
        const canvas = document.createElement("canvas")
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
        const { data } = ctx.getImageData(0, 0, sw, sh)
        let sum = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          sum += relativeLuminance(data[i], data[i + 1], data[i + 2])
          count++
        }
        resolve(count ? sum / count : 0.5)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = readableImageUrl(url)
  })
}

export async function pickContrastColorAtPosition(
  canvasEl: HTMLElement | null,
  xPct: number,
  yPct: number,
  screenshot: string | null,
  background: Background
): Promise<string> {
  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect()
    const clientX = rect.left + (xPct / 100) * rect.width
    const clientY = rect.top + (yPct / 100) * rect.height

    const elements = document.elementsFromPoint(clientX, clientY)
    const imgEl = elements.find(
      (el) =>
        el instanceof HTMLImageElement &&
        el.getAttribute("alt") === "Screenshot"
    ) as HTMLImageElement | undefined

    if (imgEl && screenshot) {
      const imgRect = imgEl.getBoundingClientRect()
      const relX = Math.max(
        0,
        Math.min(1, (clientX - imgRect.left) / imgRect.width)
      )
      const relY = Math.max(
        0,
        Math.min(1, (clientY - imgRect.top) / imgRect.height)
      )
      try {
        const lum = await sampleImageLuminanceAtPoint(screenshot, relX, relY)
        return lum > 0.5 ? "#000000" : "#ffffff"
      } catch {
        // fall through to background
      }
    }

    // If we're not above a screenshot image, inspect visible layers at the
    // point and use the first non-transparent background color.
    for (const el of elements) {
      if (!(el instanceof HTMLElement)) continue
      if (canvasEl.contains(el) === false) continue
      if (el.hasAttribute("data-export-hidden")) continue
      if (el.hasAttribute("data-editor-text-id")) continue
      const bg = window.getComputedStyle(el).backgroundColor
      if (!bg || bg === "transparent") continue
      const rgb = parseCssRgb(bg)
      if (!rgb) continue
      if (rgb.a <= 0.05) continue
      const lum = relativeLuminance(rgb.r, rgb.g, rgb.b)
      return lum > 0.5 ? "#000000" : "#ffffff"
    }
  }

  return pickContrastColor(null, background)
}
