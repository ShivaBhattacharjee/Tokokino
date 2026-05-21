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

export const GRADIENT_LIBRARY: GradientCategory[] = [
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

export const BACKGROUND_LIBRARY: BackgroundCategory[] =
  BACKGROUND_DATA

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
