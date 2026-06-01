import BACKGROUND_DATA from "./backgrounds-data.json"
import type {
  BackgroundCategory,
  GradientCategory,
  ScreenshotPosition,
} from "./state-types"

export const ANNOTATION_COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#3b82f6",
  "#ec4899",
  "#0a0a0a",
] as const

export const ANNOTATION_STROKES = [2, 4, 7, 11] as const

export const OVERLAY_COUNT = 100

const OVERLAY_BASE_URL = `https://assets.tokokino.com/overlays`

export function overlayUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/${String(id).padStart(3, "0")}.png`
}

export function overlayThumbUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/thumbs/${String(id).padStart(3, "0")}.webp`
}

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

// --- SVG-based gradient builders -------------------------------------------
// These produce CSS background strings backed by inline SVG data URIs. They
// are stored verbatim in CanvasState.background.value and applied via
// `backgroundCss()` exactly like a plain linear-gradient. The simple
// angle/colour customizer only targets `linear-gradient(...)` values, so these
// render as fixed, designed textures (no inline editing) — which is intended.

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`
}

// Grainy film-noise overlay layered on top of a base CSS gradient.
function grain(base: string, opacity = 0.22, freq = 0.85): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='${opacity}'/></svg>`
  return `${svgUrl(svg)}, ${base}`
}

type MeshBlob = { cx: number; cy: number; r: number; color: string }

// Soft radial "blobs" that fade to transparent over a solid base — a mesh-gradient look.
function meshGradient(bg: string, blobs: MeshBlob[]): string {
  const defs = blobs
    .map(
      (b, i) =>
        `<radialGradient id='g${i}' cx='${b.cx}%' cy='${b.cy}%' r='${b.r}%'><stop offset='0%' stop-color='${b.color}' stop-opacity='0.9'/><stop offset='100%' stop-color='${b.color}' stop-opacity='0'/></radialGradient>`
    )
    .join("")
  const rects = blobs
    .map((_, i) => `<rect width='100%' height='100%' fill='url(#g${i})'/>`)
    .join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' preserveAspectRatio='xMidYMid slice'><defs>${defs}</defs><rect width='100%' height='100%' fill='${bg}'/>${rects}</svg>`
  return `${svgUrl(svg)} center / cover no-repeat`
}

type AuroraBand = { y: number; h: number; rot: number; color: string }

// Blurred diagonal light streaks that fade at both ends — line gradients with fade.
function auroraGradient(bg: string, bands: AuroraBand[]): string {
  const defs = bands
    .map(
      (b, i) =>
        `<linearGradient id='b${i}' x1='0' y1='0' x2='1' y2='0'><stop offset='0%' stop-color='${b.color}' stop-opacity='0'/><stop offset='50%' stop-color='${b.color}' stop-opacity='0.75'/><stop offset='100%' stop-color='${b.color}' stop-opacity='0'/></linearGradient>`
    )
    .join("")
  const rects = bands
    .map(
      (b, i) =>
        `<rect x='-20%' y='${b.y}%' width='140%' height='${b.h}%' fill='url(#b${i})' transform='rotate(${b.rot} 200 150)'/>`
    )
    .join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' preserveAspectRatio='xMidYMid slice'><defs>${defs}<filter id='soft' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='16'/></filter></defs><rect width='100%' height='100%' fill='${bg}'/><g filter='url(#soft)'>${rects}</g></svg>`
  return `${svgUrl(svg)} center / cover no-repeat`
}

export const GRADIENT_LIBRARY: GradientCategory[] = [
  {
    // 2026 trend-led palette: oceanic blue-greens, muted neons, warm darks,
    // wellness mints, cosmic and eggplant tones, mocha/terracotta neutrals.
    key: "trending",
    label: "Trending",
    items: [
      "linear-gradient(135deg, #0d9488, #38bdf8)",
      "linear-gradient(135deg, #14b8a6, #2563eb)",
      "linear-gradient(135deg, #2e1065, #7c3aed, #ec4899)",
      "linear-gradient(135deg, #a3e635, #22d3ee)",
      "linear-gradient(135deg, #6ee7b7, #93c5fd)",
      "linear-gradient(135deg, #1e1b4b, #a78bfa)",
      "linear-gradient(135deg, #a8755a, #e07856)",
      "linear-gradient(135deg, #14532d, #4ade80)",
      "linear-gradient(135deg, #581c87, #c026d3)",
      "linear-gradient(135deg, #0f172a, #1e3a8a, #38bdf8)",
      "linear-gradient(135deg, #7c3aed, #db2777, #f59e0b)",
      "linear-gradient(135deg, #134e4a, #5eead4)",
      "linear-gradient(135deg, #84fab0, #8fd3f4)",
      "linear-gradient(135deg, #30cfd0, #330867)",
      "linear-gradient(135deg, #ff6a88, #ff99ac)",
      "linear-gradient(135deg, #5ee7df, #b490ca)",
    ],
  },
  {
    key: "warm",
    label: "Warm",
    items: [
      "linear-gradient(135deg, #f87171, #fbbf24)",
      "linear-gradient(135deg, #fb7185, #fdba74)",
      "linear-gradient(135deg, #ef4444, #f97316)",
      "linear-gradient(135deg, #f43f5e, #f59e0b)",
      "linear-gradient(135deg, #fbbf24, #f472b6)",
      "linear-gradient(135deg, #f97316, #ef4444, #db2777)",
      "linear-gradient(135deg, #fde68a, #fb923c)",
      "linear-gradient(135deg, #fda4af, #fbcfe8)",
      "linear-gradient(135deg, #ff8a65, #ff5252)",
      "linear-gradient(135deg, #ffd166, #ef476f)",
      "linear-gradient(135deg, #ff9966, #ff5e62)",
      "linear-gradient(135deg, #f6d365, #fda085)",
    ],
  },
  {
    key: "cool",
    label: "Cool",
    items: [
      "linear-gradient(135deg, #60a5fa, #a78bfa)",
      "linear-gradient(135deg, #34d399, #60a5fa)",
      "linear-gradient(135deg, #22d3ee, #818cf8)",
      "linear-gradient(135deg, #06b6d4, #3b82f6)",
      "linear-gradient(135deg, #1e3a8a, #2563eb)",
      "linear-gradient(135deg, #0ea5e9, #6366f1)",
      "linear-gradient(135deg, #2dd4bf, #06b6d4)",
      "linear-gradient(135deg, #a5f3fc, #60a5fa)",
      "linear-gradient(135deg, #4f46e5, #06b6d4)",
      "linear-gradient(135deg, #0f766e, #0ea5e9)",
      "linear-gradient(135deg, #43e97b, #38f9d7)",
      "linear-gradient(135deg, #4facfe, #00f2fe)",
    ],
  },
  {
    key: "vivid",
    label: "Vivid",
    items: [
      "linear-gradient(135deg, #f472b6, #a78bfa)",
      "linear-gradient(135deg, #ec4899, #f59e0b)",
      "linear-gradient(135deg, #d946ef, #6366f1)",
      "linear-gradient(135deg, #ee0979, #ff6a00)",
      "linear-gradient(135deg, #fa709a, #fee140)",
      "linear-gradient(135deg, #ff00cc, #333399)",
      "linear-gradient(135deg, #f857a6, #ff5858)",
      "linear-gradient(135deg, #c471f5, #fa71cd)",
      "linear-gradient(135deg, #00c6ff, #0072ff)",
      "linear-gradient(135deg, #ff5f6d, #ffc371)",
      "linear-gradient(135deg, #21d4fd, #b721ff)",
      "linear-gradient(135deg, #08aeea, #2af598)",
      "linear-gradient(135deg, #00dbde, #fc00ff)",
      "linear-gradient(135deg, #fc466b, #3f5efb)",
      "linear-gradient(135deg, #7028e4, #e5b2ca)",
      "linear-gradient(135deg, #f9d423, #ff4e50)",
    ],
  },
  {
    key: "mono",
    label: "Mono",
    items: [
      "linear-gradient(135deg, #111827, #374151)",
      "linear-gradient(135deg, #1f2937, #4b5563)",
      "linear-gradient(135deg, #f3f4f6, #9ca3af)",
      "linear-gradient(135deg, #0a0a0a, #404040)",
      "linear-gradient(135deg, #18181b, #52525b)",
      "linear-gradient(135deg, #fafafa, #d4d4d4)",
      "linear-gradient(135deg, #292524, #78716c)",
      "linear-gradient(135deg, #0c0a09, #1c1917)",
      "linear-gradient(135deg, #e4e4e7, #71717a)",
      "linear-gradient(135deg, #1e293b, #64748b)",
    ],
  },
  {
    key: "pastel",
    label: "Pastel",
    items: [
      "linear-gradient(135deg, #667eea, #764ba2)",
      "linear-gradient(120deg, #84fab0, #8fd3f4)",
      "linear-gradient(135deg, #fbc2eb, #a6c1ee)",
      "linear-gradient(135deg, #fdcbf1, #e6dee9)",
      "linear-gradient(135deg, #ff9a9e, #fecfef, #fad0c4)",
      "linear-gradient(135deg, #a8edea, #fed6e3)",
      "linear-gradient(135deg, #d299c2, #fef9d7)",
      "linear-gradient(135deg, #89f7fe, #66a6ff)",
      "linear-gradient(135deg, #fdfcfb, #e2d1c3)",
      "linear-gradient(135deg, #cfd9df, #e2ebf0)",
    ],
  },
  {
    // Grainy film-noise overlay on top of rich gradients.
    key: "noise",
    label: "Noise",
    items: [
      grain("linear-gradient(135deg, #6366f1, #a855f7)"),
      grain("linear-gradient(135deg, #0d9488, #2563eb)"),
      grain("linear-gradient(135deg, #f43f5e, #f59e0b)"),
      grain("linear-gradient(135deg, #1e1b4b, #4c1d95)", 0.28),
      grain("linear-gradient(135deg, #ec4899, #8b5cf6)"),
      grain("linear-gradient(135deg, #0f172a, #1e3a8a)", 0.3, 0.9),
      grain("linear-gradient(135deg, #f97316, #db2777)"),
      grain("linear-gradient(135deg, #14532d, #4ade80)"),
      grain("linear-gradient(135deg, #0c0a09, #292524)", 0.34, 0.95),
      grain("linear-gradient(135deg, #22d3ee, #818cf8)"),
    ],
  },
  {
    // Soft radial blobs that fade out — a mesh-gradient look built from SVG shapes.
    key: "mesh",
    label: "Mesh",
    items: [
      meshGradient("#0b1020", [
        { cx: 18, cy: 22, r: 55, color: "#6366f1" },
        { cx: 82, cy: 30, r: 50, color: "#ec4899" },
        { cx: 60, cy: 85, r: 60, color: "#06b6d4" },
      ]),
      meshGradient("#0a0f1f", [
        { cx: 25, cy: 25, r: 50, color: "#22d3ee" },
        { cx: 80, cy: 70, r: 55, color: "#3b82f6" },
        { cx: 50, cy: 50, r: 45, color: "#a855f7" },
      ]),
      meshGradient("#1a0b14", [
        { cx: 20, cy: 80, r: 55, color: "#f43f5e" },
        { cx: 75, cy: 20, r: 55, color: "#fb923c" },
        { cx: 90, cy: 90, r: 45, color: "#fbbf24" },
      ]),
      meshGradient("#06120f", [
        { cx: 22, cy: 30, r: 55, color: "#10b981" },
        { cx: 78, cy: 75, r: 55, color: "#22d3ee" },
        { cx: 55, cy: 15, r: 40, color: "#a3e635" },
      ]),
      meshGradient("#0f0a1f", [
        { cx: 15, cy: 50, r: 50, color: "#8b5cf6" },
        { cx: 85, cy: 40, r: 50, color: "#d946ef" },
        { cx: 50, cy: 90, r: 50, color: "#6366f1" },
      ]),
      meshGradient("#f8fafc", [
        { cx: 20, cy: 25, r: 55, color: "#a5b4fc" },
        { cx: 80, cy: 35, r: 50, color: "#fbcfe8" },
        { cx: 55, cy: 90, r: 55, color: "#99f6e4" },
      ]),
      meshGradient("#0c0a09", [
        { cx: 30, cy: 20, r: 50, color: "#f59e0b" },
        { cx: 80, cy: 80, r: 55, color: "#ef4444" },
        { cx: 15, cy: 85, r: 45, color: "#a855f7" },
      ]),
      meshGradient("#031a1f", [
        { cx: 25, cy: 70, r: 55, color: "#2dd4bf" },
        { cx: 75, cy: 25, r: 50, color: "#0ea5e9" },
        { cx: 90, cy: 85, r: 40, color: "#34d399" },
      ]),
      // Hyper-digital: acid green / cyan / hyper-violet
      meshGradient("#070314", [
        { cx: 20, cy: 30, r: 50, color: "#a3e635" },
        { cx: 78, cy: 28, r: 50, color: "#22d3ee" },
        { cx: 50, cy: 88, r: 55, color: "#7c3aed" },
      ]),
      // Purple + orange
      meshGradient("#120512", [
        { cx: 22, cy: 25, r: 55, color: "#9333ea" },
        { cx: 80, cy: 78, r: 55, color: "#fb923c" },
        { cx: 88, cy: 22, r: 40, color: "#e879f9" },
      ]),
      // Teal + rose pink
      meshGradient("#04141a", [
        { cx: 25, cy: 75, r: 55, color: "#14b8a6" },
        { cx: 75, cy: 28, r: 55, color: "#fb7185" },
        { cx: 50, cy: 50, r: 38, color: "#5eead4" },
      ]),
      // Cosmic four-point glow
      meshGradient("#05030f", [
        { cx: 15, cy: 20, r: 45, color: "#6366f1" },
        { cx: 85, cy: 25, r: 45, color: "#ec4899" },
        { cx: 20, cy: 85, r: 45, color: "#06b6d4" },
        { cx: 85, cy: 85, r: 45, color: "#f59e0b" },
      ]),
      // Patina blue / transformative teal
      meshGradient("#02101a", [
        { cx: 30, cy: 35, r: 55, color: "#0ea5e9" },
        { cx: 78, cy: 65, r: 55, color: "#2dd4bf" },
        { cx: 60, cy: 12, r: 38, color: "#38bdf8" },
      ]),
      // Sunset amber / magenta
      meshGradient("#160309", [
        { cx: 18, cy: 28, r: 55, color: "#fbbf24" },
        { cx: 82, cy: 35, r: 50, color: "#db2777" },
        { cx: 55, cy: 90, r: 55, color: "#f97316" },
      ]),
      // Soft light lavender / sky / mint
      meshGradient("#f5f3ff", [
        { cx: 22, cy: 30, r: 55, color: "#c4b5fd" },
        { cx: 80, cy: 28, r: 50, color: "#bae6fd" },
        { cx: 55, cy: 92, r: 55, color: "#a7f3d0" },
      ]),
      // Eggplant / hunter green
      meshGradient("#0a0612", [
        { cx: 25, cy: 25, r: 55, color: "#7e22ce" },
        { cx: 78, cy: 78, r: 55, color: "#15803d" },
        { cx: 85, cy: 18, r: 40, color: "#4ade80" },
      ]),
    ],
  },
  {
    // Blurred diagonal streaks fading at both ends — line gradients with fade.
    key: "aurora",
    label: "Aurora",
    items: [
      auroraGradient("#070b1a", [
        { y: 18, h: 16, rot: -18, color: "#22d3ee" },
        { y: 42, h: 18, rot: -18, color: "#8b5cf6" },
        { y: 66, h: 16, rot: -18, color: "#ec4899" },
      ]),
      auroraGradient("#0a0716", [
        { y: 22, h: 20, rot: -28, color: "#a855f7" },
        { y: 52, h: 20, rot: -28, color: "#6366f1" },
      ]),
      auroraGradient("#05121a", [
        { y: 20, h: 16, rot: 16, color: "#2dd4bf" },
        { y: 44, h: 18, rot: 16, color: "#38bdf8" },
        { y: 68, h: 16, rot: 16, color: "#a3e635" },
      ]),
      auroraGradient("#15060f", [
        { y: 24, h: 18, rot: -22, color: "#fb7185" },
        { y: 50, h: 20, rot: -22, color: "#f59e0b" },
        { y: 74, h: 16, rot: -22, color: "#f43f5e" },
      ]),
      auroraGradient("#020617", [
        { y: 16, h: 14, rot: -12, color: "#60a5fa" },
        { y: 40, h: 16, rot: -12, color: "#34d399" },
        { y: 64, h: 18, rot: -12, color: "#a78bfa" },
      ]),
      auroraGradient("#0d0a05", [
        { y: 26, h: 20, rot: 24, color: "#fbbf24" },
        { y: 56, h: 20, rot: 24, color: "#f97316" },
      ]),
      // Northern-lights green / teal / violet
      auroraGradient("#030f0c", [
        { y: 18, h: 16, rot: -14, color: "#34d399" },
        { y: 42, h: 18, rot: -14, color: "#2dd4bf" },
        { y: 66, h: 16, rot: -14, color: "#818cf8" },
      ]),
      // Acid green / cyan / hyper-violet streaks
      auroraGradient("#070314", [
        { y: 20, h: 16, rot: 20, color: "#a3e635" },
        { y: 44, h: 18, rot: 20, color: "#22d3ee" },
        { y: 68, h: 16, rot: 20, color: "#a855f7" },
      ]),
      // Rose / amber warm bands
      auroraGradient("#160309", [
        { y: 22, h: 18, rot: -20, color: "#fb7185" },
        { y: 50, h: 20, rot: -20, color: "#fbbf24" },
        { y: 76, h: 16, rot: -20, color: "#e879f9" },
      ]),
      // Steep ice-blue cascade
      auroraGradient("#020814", [
        { y: 16, h: 14, rot: -34, color: "#38bdf8" },
        { y: 40, h: 16, rot: -34, color: "#818cf8" },
        { y: 64, h: 18, rot: -34, color: "#22d3ee" },
      ]),
    ],
  },
]

export const GRADIENT_PRESETS = GRADIENT_LIBRARY.flatMap((c) => c.items)

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

export const BACKGROUND_LIBRARY: BackgroundCategory[] = BACKGROUND_DATA

export const DEFAULT_IMAGE_BACKGROUND_ENTRY =
  BACKGROUND_LIBRARY[0]?.items[0] ?? null

export const DEFAULT_IMAGE_BACKGROUND =
  DEFAULT_IMAGE_BACKGROUND_ENTRY?.full ?? ""

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
  { id: 13, name: "Circles" },
  { id: 14, name: "Rays" },
] as const

export const AUTO_PLACEHOLDER_GRADIENT =
  "linear-gradient(135deg, #1f2937, #4b5563)"
