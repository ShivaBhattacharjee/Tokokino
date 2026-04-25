"use client"

import * as React from "react"

export type AspectState = { id: string; w: number; h: number }

export type BgType = "none" | "solid" | "gradient" | "image" | "auto"

export type Background = { type: BgType; value: string }

export type Tilt = { rx: number; ry: number; rz: number }

export type Border = { color: string | null; width: number }

export type BackdropEffects = {
  noise: number
  blur: number
  brightness: number
  saturation: number
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

export type ShadowType = "none" | "drop" | "glow"

export type Shadow = {
  type: ShadowType
  intensity: number
  lightSource: string
}

export type OverlayPosition = "overlay" | "underlay"

export type Overlay = {
  id: number | null
  opacity: number
  position: OverlayPosition
}

export const OVERLAY_COUNT = 100

export type EditorState = {
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

export const IMAGE_PRESETS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?q=80&w=1200&auto=format&fit=crop",
]

const DEFAULT_STATE: EditorState = {
  screenshot: null,
  aspect: { id: "16-10", w: 1920, h: 1200 },
  background: {
    type: "gradient",
    value: GRADIENT_PRESETS[2],
  },
  padding: 96,
  borderRadius: 12,
  border: { color: null, width: 1 },
  backdrop: {
    effects: {
      noise: 0,
      blur: 0,
      brightness: 100,
      saturation: 100,
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
  shadow: {
    type: "drop",
    intensity: 40,
    lightSource: "center",
  },
  overlay: {
    id: null,
    opacity: 50,
    position: "overlay",
  },
  canvasBorderRadius: 16,
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
  setShadow: (s: Shadow) => void
  setOverlay: (o: Overlay) => void
  reset: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
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

  const value: Ctx = React.useMemo(() => {
    const set = (patch: Partial<EditorState>, group: string | null) =>
      dispatch({ type: "SET", patch, group })
    return {
      ...state.present,
      setScreenshot: (s) => set({ screenshot: s }, null),
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
      setShadow: (s) => set({ shadow: s }, "shadow"),
      setOverlay: (o) => set({ overlay: o }, "overlay"),
      reset: () => dispatch({ type: "RESET" }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }
  }, [state])

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
  if (e.saturation !== 100) parts.push(`saturate(${e.saturation}%)`)
  if (e.opacity !== 100) parts.push(`opacity(${e.opacity}%)`)
  return parts.length ? parts.join(" ") : undefined
}

export function shadowCss(shadow: Shadow): string | undefined {
  if (shadow.type === "none" || shadow.intensity <= 0) return undefined
  const intensity = shadow.intensity / 100

  if (shadow.type === "glow") {
    const blur = 30 + intensity * 90
    const spread = intensity * 8
    const opacity = 0.18 + intensity * 0.42
    return `0 0 ${blur}px ${spread}px rgba(0, 0, 0, ${opacity.toFixed(3)})`
  }

  // drop shadow — directional, opposite the light source
  let dx = 0
  let dy = 0
  if (shadow.lightSource !== "center") {
    const [r, c] = shadow.lightSource.split("-").map(Number)
    if (Number.isFinite(r) && Number.isFinite(c)) {
      dx = -(c - 2)
      dy = -(r - 2)
    }
  }
  const unit = intensity * 16
  const offsetX = dx * unit
  const offsetY = dy * unit
  const blur = 20 + intensity * 60
  const spread = -2
  const opacity = 0.15 + intensity * 0.35
  return `${offsetX.toFixed(1)}px ${offsetY.toFixed(1)}px ${blur.toFixed(
    1
  )}px ${spread}px rgba(0, 0, 0, ${opacity.toFixed(3)})`
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
