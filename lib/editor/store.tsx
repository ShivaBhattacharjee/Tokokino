"use client"

import * as React from "react"

import BACKGROUND_DATA from "./backgrounds-data.json"

export type AspectState = { id: string; w: number; h: number }

export type BgType = "none" | "solid" | "gradient" | "image" | "auto"

export type Background = { type: BgType; value: string }

export type Tilt = { rx: number; ry: number; rz: number }

export type BorderStyle = "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge"

export type Border = { color: string | null; width: number; style?: BorderStyle }

export type BackdropEffects = {
  noise: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
  hue: number
  grayscale: number
  sepia: number
  invert: number
  opacity: number
}

export type BackdropPattern = {
  ids: number[]
  intensity: number
  thickness: number
  color: string
}

export type Backdrop = {
  effects: BackdropEffects
  pattern: BackdropPattern
}

export type ShadowType = "none" | "drop" | "soft" | "hard" | "glow" | "float"

export type Shadow = {
  type: ShadowType
  intensity: number
  lightSource: string
  color: string
}

export type OverlayPosition = "overlay" | "underlay"

export type Overlay = {
  id: number | null
  opacity: number
  position: OverlayPosition
}

export type EditorTool =
  | "pointer"
  | "crop"
  | "text"
  | "arrow"
  | "position"
  | "layers"
  | "enhance"

export type ScreenshotPosition =
  | "center"
  | "0-0"
  | "0-1"
  | "0-2"
  | "0-3"
  | "0-4"
  | "1-0"
  | "1-1"
  | "1-2"
  | "1-3"
  | "1-4"
  | "2-0"
  | "2-1"
  | "2-3"
  | "2-4"
  | "3-0"
  | "3-1"
  | "3-2"
  | "3-3"
  | "3-4"
  | "4-0"
  | "4-1"
  | "4-2"
  | "4-3"
  | "4-4"

export const SCREENSHOT_POSITIONS = Array.from({ length: 25 }, (_, i) => {
  const row = Math.floor(i / 5)
  const col = i % 5
  const dx = col - 2
  const dy = row - 2
  const isCenter = dx === 0 && dy === 0
  return {
    id: (isCenter ? "center" : `${row}-${col}`) as ScreenshotPosition,
    isCenter,
    row,
    col,
    angle: isCenter ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI,
  }
})

export function screenshotPositionAnchor(position: ScreenshotPosition): {
  x: number
  y: number
} {
  if (position === "center") return { x: 50, y: 50 }
  const [row, col] = position.split("-").map(Number)
  if (!Number.isFinite(row) || !Number.isFinite(col)) return { x: 50, y: 50 }
  return {
    x: Math.max(0, Math.min(4, col)) * 25,
    y: Math.max(0, Math.min(4, row)) * 25,
  }
}

export const OVERLAY_COUNT = 100

export type EditorState = {
  activeTool: EditorTool
  screenshot: string | null
  aspect: AspectState
  background: Background
  padding: number
  borderRadius: number
  canvasBorderRadius: number
  border: Border
  backdrop: Backdrop
  tilt: Tilt
  scale: number
  canvasZoom: number
  screenshotPosition: ScreenshotPosition
  screenshotOffset: { x: number; y: number }
  shadow: Shadow
  overlay: Overlay
}

const OVERLAY_BASE_URL =
  process.env.NEXT_PUBLIC_OVERLAYS_BASE_URL ??
  "https://pub-4a1f61370c844ff69cc9d1a7b3689d25.r2.dev/overlays"

export function overlayUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/${String(id).padStart(3, "0")}.png`
}

export function overlayThumbUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/thumbs/${String(id).padStart(3, "0")}.webp`
}

export const GRADIENT_PRESETS = [
  "linear-gradient(135deg, #f87171, #fbbf24)",
  "linear-gradient(135deg, #60a5fa, #a78bfa)",
  "linear-gradient(135deg, #34d399, #60a5fa)",
  "linear-gradient(135deg, #f472b6, #a78bfa)",
  "linear-gradient(135deg, #fbbf24, #f472b6)",
  "linear-gradient(135deg, #111827, #374151)",
  "linear-gradient(135deg, #fb7185, #fdba74)",
  "linear-gradient(135deg, #22d3ee, #818cf8)",
]

export const SOLID_PRESETS = [
  "#0f172a",
  "#ffffff",
  "#f87171",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#ef4444",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#ec4899",
]

export type BackgroundEntry = {
  id: string
  name: string
  full: string
  thumb: string
}

export type BackgroundCategory = {
  key: string
  label: string
  items: BackgroundEntry[]
}

export const BACKGROUND_LIBRARY: BackgroundCategory[] =
  BACKGROUND_DATA as BackgroundCategory[]

export const DEFAULT_IMAGE_BACKGROUND =
  BACKGROUND_LIBRARY[0]?.items[0]?.full ?? ""

const DEFAULT_STATE: EditorState = {
  activeTool: "pointer",
  screenshot: null,
  aspect: { id: "16-10", w: 1920, h: 1200 },
  background: {
    type: "image",
    value: DEFAULT_IMAGE_BACKGROUND,
  },
  padding: 96,
  borderRadius: 12,
  canvasBorderRadius: 16,
  border: { color: null, width: 1, style: "solid" },
  backdrop: {
    effects: {
      noise: 0,
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      opacity: 100,
    },
    pattern: {
      ids: [],
      intensity: 50,
      thickness: 1,
      color: "#FFFFFF",
    },
  },
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  canvasZoom: 100,
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
  shadow: {
    type: "drop",
    intensity: 40,
    lightSource: "center",
    color: "#000000",
  },
  overlay: {
    id: null,
    opacity: 50,
    position: "overlay",
  },
}

const HISTORY_LIMIT = 100
const GROUP_MERGE_MS = 600

type HistoryState = {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  lastGroup: string | null
  lastTs: number
}

type Action =
  | { type: "SET"; patch: Partial<EditorState>; group: string | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" }

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "SET": {
      const present = { ...state.present, ...action.patch }
      const now = Date.now()
      const canMerge =
        action.group !== null &&
        action.group === state.lastGroup &&
        now - state.lastTs < GROUP_MERGE_MS
      if (canMerge) {
        return {
          ...state,
          present,
          future: [],
          lastTs: now,
        }
      }
      const past = [...state.past, state.present]
      if (past.length > HISTORY_LIMIT) past.shift()
      return {
        past,
        present,
        future: [],
        lastGroup: action.group,
        lastTs: now,
      }
    }
    case "UNDO": {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        lastGroup: null,
        lastTs: 0,
      }
    }
    case "REDO": {
      if (!state.future.length) return state
      const next = state.future[0]
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        lastGroup: null,
        lastTs: 0,
      }
    }
    case "RESET": {
      return {
        past: [...state.past, state.present],
        present: DEFAULT_STATE,
        future: [],
        lastGroup: null,
        lastTs: 0,
      }
    }
  }
}

type Ctx = EditorState & {
  setActiveTool: (t: EditorTool) => void
  setScreenshot: (s: string | null) => void
  setAspect: (a: AspectState) => void
  setBackground: (b: Background) => void
  setPadding: (n: number) => void
  setBorderRadius: (n: number) => void
  setCanvasBorderRadius: (n: number) => void
  setBorder: (b: Border) => void
  setBackdropEffects: (e: BackdropEffects) => void
  setBackdropPattern: (p: BackdropPattern) => void
  setTilt: (t: Tilt) => void
  setScale: (n: number) => void
  setCanvasZoom: (n: number) => void
  setScreenshotPosition: (p: ScreenshotPosition) => void
  setScreenshotOffset: (o: { x: number; y: number }) => void
  setShadow: (s: Shadow) => void
  setOverlay: (o: Overlay) => void
  reset: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isPreviewMode: boolean
  setIsPreviewMode: (p: boolean) => void
}

const EditorContext = React.createContext<Ctx | null>(null)

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, {
    past: [],
    present: DEFAULT_STATE,
    future: [],
    lastGroup: null,
    lastTs: 0,
  })
  const [isPreviewMode, setIsPreviewMode] = React.useState(false)

  const value: Ctx = React.useMemo(() => {
    const set = (patch: Partial<EditorState>, group: string | null) =>
      dispatch({ type: "SET", patch, group })
    return {
      ...state.present,
      setActiveTool: (t) => set({ activeTool: t }, null),
      setScreenshot: (s) =>
        set(
          {
            screenshot: s,
            screenshotPosition: "center",
            screenshotOffset: { x: 0, y: 0 },
          },
          null
        ),
      setAspect: (a) => set({ aspect: a }, "aspect"),
      setBackground: (b) => set({ background: b }, "background"),
      setPadding: (n) => set({ padding: n }, "padding"),
      setBorderRadius: (n) => set({ borderRadius: n }, "borderRadius"),
      setCanvasBorderRadius: (n) =>
        set({ canvasBorderRadius: n }, "canvasBorderRadius"),
      setBorder: (b) => set({ border: b }, "border"),
      setBackdropEffects: (e) =>
        set(
          { backdrop: { ...state.present.backdrop, effects: e } },
          "backdrop-effects"
        ),
      setBackdropPattern: (p) =>
        set(
          { backdrop: { ...state.present.backdrop, pattern: p } },
          "backdrop-pattern"
        ),
      setTilt: (t) => set({ tilt: t }, "tilt"),
      setScale: (n) => set({ scale: n }, "scale"),
      setCanvasZoom: (n) => set({ canvasZoom: n }, "canvasZoom"),
      setScreenshotPosition: (p) =>
        set(
          { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
          "screenshotPosition"
        ),
      setScreenshotOffset: (o) => set({ screenshotOffset: o }, "screenshotOffset"),
      setShadow: (s) => set({ shadow: s }, "shadow"),
      setOverlay: (o) => set({ overlay: o }, "overlay"),
      reset: () => dispatch({ type: "RESET" }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      isPreviewMode,
      setIsPreviewMode,
    }
  }, [state, isPreviewMode])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true
      if (isEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault()
        if (e.shiftKey) dispatch({ type: "REDO" })
        else dispatch({ type: "UNDO" })
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault()
        dispatch({ type: "REDO" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}

export function useEditor() {
  const ctx = React.useContext(EditorContext)
  if (!ctx) throw new Error("useEditor must be used within EditorProvider")
  return ctx
}

export const BACKDROP_PATTERNS = [
  { id: 1, name: "Dots" },
  { id: 2, name: "Grid" },
  { id: 3, name: "Diagonals" },
  { id: 4, name: "Noise" },
  { id: 5, name: "Mesh" },
  { id: 6, name: "Waves" },
  { id: 7, name: "Crosshatch" },
  { id: 8, name: "H-Lines" },
  { id: 9, name: "V-Lines" },
  { id: 10, name: "Rings" },
  { id: 11, name: "Chevron" },
  { id: 12, name: "Stripes" },
] as const

export function patternCssFor(
  id: number,
  color: string,
  thickness: number
): React.CSSProperties {
  const t = Math.max(0.5, thickness)
  switch (id) {
    case 1:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "10px 10px",
      }
    case 2:
      return {
        backgroundImage: `linear-gradient(${color} ${t}px, transparent ${t}px), linear-gradient(90deg, ${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "14px 14px",
      }
    case 3:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 8px)`,
      }
    case 4:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px), radial-gradient(${color} ${Math.max(
          0.5,
          t - 0.3
        )}px, transparent ${Math.max(0.5, t - 0.3)}px)`,
        backgroundSize: "9px 9px, 13px 13px",
        backgroundPosition: "0 0, 4px 4px",
      }
    case 5:
      return {
        backgroundImage: `conic-gradient(from 180deg at 50% 50%, ${color}, transparent, ${color})`,
      }
    case 6:
      return {
        backgroundImage: `linear-gradient(30deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%), linear-gradient(150deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%)`,
        backgroundSize: "60px 100px",
      }
    case 7:
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 ${t}px, transparent ${t}px 10px), repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 8:
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 9:
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 10: {
      const r = Math.max(3, 5 - t / 2)
      return {
        backgroundImage: `radial-gradient(circle, transparent ${r}px, ${color} ${r}px ${r + t}px, transparent ${r + t}px)`,
        backgroundSize: "20px 20px",
      }
    }
    case 11:
      return {
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%)`,
        backgroundSize: "16px 16px",
        backgroundPosition: "-8px 0, -8px 0, 0 0, 0 0",
      }
    case 12:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t * 3}px, transparent ${t * 3}px ${t * 6}px)`,
      }
    default:
      return {}
  }
}

export function effectsFilterCss(e: BackdropEffects): string | undefined {
  const parts: string[] = []
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`)
  if (e.brightness !== 100) parts.push(`brightness(${e.brightness}%)`)
  if (e.contrast !== 100) parts.push(`contrast(${e.contrast}%)`)
  if (e.saturation !== 100) parts.push(`saturate(${e.saturation}%)`)
  if (e.hue !== 0) parts.push(`hue-rotate(${e.hue}deg)`)
  if (e.grayscale > 0) parts.push(`grayscale(${e.grayscale}%)`)
  if (e.sepia > 0) parts.push(`sepia(${e.sepia}%)`)
  if (e.invert > 0) parts.push(`invert(${e.invert}%)`)
  if (e.opacity !== 100) parts.push(`opacity(${e.opacity}%)`)
  return parts.length ? parts.join(" ") : undefined
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
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

function shadowRgba(color: string, opacity: number): string {
  const { r, g, b } = hexToRgb(color || "#000000")
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`
}

export function shadowCss(shadow: Shadow): string | undefined {
  if (shadow.type === "none" || shadow.intensity <= 0) return undefined
  const intensity = shadow.intensity / 100
  const color = shadow.color || "#000000"

  if (shadow.type === "glow") {
    const blur = 30 + intensity * 90
    const spread = intensity * 8
    const opacity = 0.18 + intensity * 0.42
    return `0 0 ${blur}px ${spread}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "soft") {
    let dx = 0, dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) { dx = -(c - 2); dy = -(r - 2) }
    }
    const unit = intensity * 10
    const blur = 40 + intensity * 80
    const spread = intensity * 4
    const opacity = 0.1 + intensity * 0.2
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread.toFixed(1)}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "hard") {
    let dx = 0, dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) { dx = -(c - 2); dy = -(r - 2) }
    }
    const unit = intensity * 12
    const opacity = 0.25 + intensity * 0.45
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px 0px 0px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "float") {
    const opacity1 = 0.12 + intensity * 0.18
    const opacity2 = 0.08 + intensity * 0.12
    const blur1 = 15 + intensity * 25
    const blur2 = 40 + intensity * 60
    const dy1 = 4 + intensity * 12
    const dy2 = 8 + intensity * 20
    return `0 ${dy1.toFixed(1)}px ${blur1.toFixed(1)}px 0px ${shadowRgba(color, opacity1)}, 0 ${dy2.toFixed(1)}px ${blur2.toFixed(1)}px 0px ${shadowRgba(color, opacity2)}`
  }

  // drop — directional, opposite the light source
  let dx = 0, dy = 0
  if (shadow.lightSource !== "center") {
    const [r, c] = shadow.lightSource.split("-").map(Number)
    if (Number.isFinite(r) && Number.isFinite(c)) { dx = -(c - 2); dy = -(r - 2) }
  }
  const unit = intensity * 16
  const blur = 20 + intensity * 60
  const spread = -2
  const opacity = 0.15 + intensity * 0.35
  return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread}px ${shadowRgba(color, opacity)}`
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

function muteRgb(r: number, g: number, b: number): string {
  const hex =
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const sat = Math.min(28, hsl.s * 0.45)
  const lightness = hsl.l < 50 ? 78 : 82
  return `hsl(${Math.round(hsl.h)} ${Math.round(sat)}% ${lightness}%)`
}

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
        reject(err)
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = url
  })
  dominantColorCache.set(url, result)
  return result
}

function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  )
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

export function backgroundCss(bg: Background): React.CSSProperties {
  if (bg.type === "none") return {}
  if (bg.type === "image") {
    return {
      backgroundImage: `url("${bg.value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  }
  return { background: bg.value }
}

export const AUTO_PLACEHOLDER_GRADIENT =
  "linear-gradient(135deg, #1f2937, #4b5563)"
