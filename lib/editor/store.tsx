"use client"

import * as React from "react"

import BACKGROUND_DATA from "./backgrounds-data.json"

export type AspectState = { id: string; w: number; h: number }

export type CropRegion = { x: number; y: number; width: number; height: number }

export type BgType = "none" | "solid" | "gradient" | "image" | "auto"

export type Background = { type: BgType; value: string }

export type Tilt = { rx: number; ry: number; rz: number }

export type BorderStyle =
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"

export type Border = {
  color: string | null
  width: number
  style?: BorderStyle
  padding: number
}

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
  filter: AssetFilter
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

export type FrameOrientation = "vertical" | "horizontal"

export type DeviceFrame = {
  id: string
  color: string
  orientation: FrameOrientation
}

export type PortraitMode = "off" | "soft" | "studio" | "spot" | "frame" | "iris"

export type Portrait = {
  mode: PortraitMode
  intensity: number
}

export type AssetFilter =
  | "none"
  | "bw"
  | "sepia"
  | "vintage"
  | "warm"
  | "cool"
  | "fade"
  | "vivid"
  | "noir"
  | "dream"
  | "mono"
  | "invert"

export type AssetBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export type AssetElement = {
  id: string
  src: string
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number | null
  rotation: number
  zIndex: number
  opacity: number
  filter: AssetFilter
  blendMode: AssetBlendMode
  hidden?: boolean
}

export type ScreenshotLayer = {
  zIndex: number
  opacity: number
  blendMode: AssetBlendMode
  hidden: boolean
}

export function assetFilterCss(filter: AssetFilter): string | undefined {
  switch (filter) {
    case "bw":
      return "grayscale(1) contrast(1.05)"
    case "sepia":
      return "sepia(0.85) saturate(1.1)"
    case "vintage":
      return "sepia(0.4) contrast(0.95) saturate(0.9) hue-rotate(-10deg)"
    case "warm":
      return "saturate(1.15) hue-rotate(-12deg) brightness(1.04)"
    case "cool":
      return "saturate(1.1) hue-rotate(15deg) brightness(1.02)"
    case "fade":
      return "contrast(0.85) brightness(1.08) saturate(0.85)"
    case "vivid":
      return "saturate(1.5) contrast(1.15)"
    case "noir":
      return "grayscale(1) contrast(1.35) brightness(0.9)"
    case "dream":
      return "blur(0.5px) saturate(1.2) brightness(1.05) contrast(0.95)"
    case "mono":
      return "grayscale(1) sepia(0.3) contrast(1.05)"
    case "invert":
      return "invert(1) hue-rotate(180deg)"
    case "none":
    default:
      return undefined
  }
}

export type TextAlign = "left" | "center" | "right"

export type TextElement = {
  id: string
  content: string
  xPct: number
  yPct: number
  rotation: number
  fontSize: number
  fontFamily: string
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  color: string
  align: TextAlign
  borderColor: string | null
  borderWidth: number
  borderStyle: BorderStyle
  zIndex: number
  widthPx: number | null
  heightPx: number | null
  autoColor: boolean
  opacity?: number
  blendMode?: AssetBlendMode
  hidden?: boolean
}

export type FontCategory = "sans" | "serif" | "mono" | "script" | "system"

export type FontFamilyOption = {
  id: string
  label: string
  css: string
  category: FontCategory
}

const SANS_FONT_LABELS = [
  "Inter",
  "Roboto",
  "Poppins",
  "Geist",
  "Outfit",
  "Space Grotesk",
  "Nunito",
  "Raleway",
  "Oswald",
  "Doto",
  "ABeeZee",
  "Abel",
  "Aclonica",
  "Acme",
  "Actor",
  "Advent Pro",
  "Afacad",
  "Afacad Flux",
  "Agdasima",
  "Akatab",
  "Akshar",
  "Alan Sans",
  "Alata",
  "Alatsi",
  "Albert Sans",
  "Aldrich",
  "Alef",
  "Alegreya Sans",
  "Alegreya Sans SC",
  "Alexandria",
  "Allerta",
  "Allerta Stencil",
  "Almarai",
  "Alumni Sans",
  "Alumni Sans Collegiate One",
  "Alumni Sans Pinstripe",
  "Alumni Sans SC",
  "Amaranth",
  "Amarna",
  "Amiko",
  "Anaheim",
  "Ancizar Sans",
  "Andika",
  "Anek Bangla",
  "Anek Devanagari",
  "Anek Gujarati",
  "Anek Gurmukhi",
  "Anek Kannada",
  "Anek Latin",
  "Anek Malayalam",
  "Anek Odia",
  "Anek Tamil",
  "Anek Telugu",
  "Anta",
  "Antic",
  "Anton",
  "Anton SC",
  "Antonio",
  "Anuphan",
  "AR One Sans",
  "Archivo",
  "Archivo Black",
  "Archivo Narrow",
  "Arimo",
  "Armata",
  "Arsenal",
  "Arsenal SC",
  "Arya",
  "Asap",
  "Asap Condensed",
  "Asimovian",
  "Assistant",
  "Asta Sans",
  "Athiti",
  "Atkinson Hyperlegible",
  "Atkinson Hyperlegible Mono",
  "Atkinson Hyperlegible Next",
  "Average Sans",
  "B612",
  "Bai Jamjuree",
  "Barlow",
  "Barlow Condensed",
  "Barlow Semi Condensed",
  "Basic",
  "Bayon",
  "BBH Bartle",
  "BBH Bogle",
  "BBH Hegarty",
  "Be Vietnam Pro",
  "Bebas Neue",
  "Beiruti",
  "Belanosima",
  "Belleza",
  "BenchNine",
  "Biryani",
  "BIZ UDGothic",
  "BIZ UDPGothic",
  "Black Han Sans",
  "Blinker",
  "Cabin",
] as const

const SERIF_FONT_LABELS = [
  "Playfair Display",
  "Lora",
  "Abhaya Libre",
  "Abyssinica SIL",
  "Adamina",
  "Alegreya",
  "Alegreya SC",
  "Aleo",
  "Alice",
  "Alike",
  "Alike Angular",
  "Alkalami",
  "Almendra",
  "Almendra SC",
  "Alyamama",
  "Amethysta",
  "Amiri",
  "Amiri Quran",
  "Ancizar Serif",
  "Andada Pro",
  "Annapurna SIL",
  "Antic Didone",
  "Antic Slab",
  "Aoboshi One",
  "Arapey",
  "Arbutus",
  "Arbutus Slab",
  "Aref Ruqaa",
  "Aref Ruqaa Ink",
  "Artifika",
  "Arvo",
  "Asar",
  "Asul",
  "Average",
  "Bacasime Antique",
  "Balthazar",
  "Baskervville",
  "Baskervville SC",
  "Belgrano",
  "Bellefair",
  "Benne",
  "Bentham",
  "Besley",
  "Bevan",
  "BhuTuka Expanded One",
  "BioRhyme",
  "BioRhyme Expanded",
  "Bitter",
  "BIZ UDMincho",
  "BIZ UDPMincho",
  "BJCree",
  "Bodoni Moda",
  "Bodoni Moda SC",
  "Bona Nova",
  "Bona Nova SC",
  "Brawler",
  "Bree Serif",
  "Brygada 1918",
  "Buenard",
  "Cactus Classical Serif",
  "Caladea",
  "Cambo",
  "Cantata One",
  "Cardo",
  "Castoro",
  "Caudex",
  "Charis SIL",
  "Chiron Sung HK",
  "Cinzel",
  "Copse",
  "Cormorant",
  "Cormorant Garamond",
  "Cormorant Infant",
  "Cormorant SC",
  "Cormorant Unicase",
  "Cormorant Upright",
  "Coustard",
  "Crete Round",
  "Crimson Pro",
  "Crimson Text",
  "Cutive",
  "Dai Banna SIL",
  "Danfo",
  "David Libre",
  "Della Respira",
  "Diphylleia",
  "DM Serif Display",
  "DM Serif Text",
  "Domine",
  "Donegal One",
  "EB Garamond",
  "Eczar",
  "Enriqueta",
  "Epunda Slab",
  "Esteban",
  "Fanwood Text",
  "Fauna One",
  "Faustina",
  "Fraunces",
  "Gelasio",
] as const

const GOOGLE_MONO_LABELS = [
  "Fira Code",
  "Anonymous Pro",
  "Azeret Mono",
  "B612 Mono",
  "Chivo Mono",
  "Courier Prime",
  "Cousine",
  "Cutive Mono",
  "Datatype",
  "DM Mono",
  "Fira Mono",
  "Fragment Mono",
  "Geist Mono",
  "Google Sans Code",
  "IBM Plex Mono",
  "Inconsolata",
  "Intel One Mono",
  "Iosevka Charon",
  "Iosevka Charon Mono",
  "JetBrains Mono",
  "Kode Mono",
  "Lekton",
  "Libertinus Mono",
  "Lilex",
  "LXGW WenKai Mono TC",
  "M PLUS 1 Code",
  "Major Mono Display",
  "Martian Mono",
  "Monofett",
  "Nova Mono",
  "Overpass Mono",
  "Oxygen Mono",
  "PT Mono",
  "Red Hat Mono",
  "Reddit Mono",
  "Roboto Mono",
  "Share Tech Mono",
  "Sixtyfour",
  "Sixtyfour Convergence",
  "Sometype Mono",
  "Source Code Pro",
  "Space Mono",
  "Spline Sans Mono",
  "Syne Mono",
  "Ubuntu Mono",
  "Ubuntu Sans Mono",
  "Victor Mono",
  "VT323",
  "Workbench",
  "Xanh Mono",
] as const

const EXTRA_MONO_LABELS = [
  "SF Mono",
  "Menlo",
  "Monaco",
  "Consolas",
  "Cascadia Code",
  "Cascadia Mono",
  "Hack",
  "Hasklig",
  "Input Mono",
  "PragmataPro",
  "Dank Mono",
  "Operator Mono",
  "Berkeley Mono",
  "Commit Mono",
  "Cartograph CF",
  "Monaspace Argon",
  "Monaspace Neon",
  "Monaspace Xenon",
  "Monaspace Radon",
  "Monaspace Krypton",
  "Iosevka",
  "Recursive Mono",
  "DejaVu Sans Mono",
  "Liberation Mono",
  "Noto Sans Mono",
  "Andale Mono",
  "Droid Sans Mono",
  "Meslo LG",
  "Proggy Clean",
  "Terminus",
  "Anonymous",
  "Code New Roman",
  "Cascadia Code PL",
  "Cascadia Mono PL",
  "IBM 3270",
  "Monoid",
  "Agave",
  "Envy Code R",
  "Sudo",
  "Fixedsys Excelsior",
  "Inziu Iosevka",
  "Ubuntu Mono Nerd Font",
  "JetBrains Mono NL",
  "Victor Mono Nerd Font",
  "Sarasa Mono",
  "Tamsyn",
  "Go Mono",
  "PT Root UI Mono",
  "Maple Mono",
  "Recursive",
] as const

const SCRIPT_FONT_LABELS = [
  "Dancing Script",
  "Caveat",
  "Aguafina Script",
  "Alex Brush",
  "Allison",
  "Allura",
  "Amatic SC",
  "Amita",
  "Annie Use Your Telescope",
  "Architects Daughter",
  "Are You Serious",
  "Arizonia",
  "Babylonica",
  "Bad Script",
  "Ballet",
  "Beau Rivage",
  "Berkshire Swash",
  "Betania Patmos",
  "Betania Patmos GDL",
  "Betania Patmos In",
  "Betania Patmos In GDL",
  "Beth Ellen",
  "Bilbo",
  "Bilbo Swash Caps",
  "Birthstone",
  "Birthstone Bounce",
  "Bonbon",
  "Bonheur Royale",
  "Borel",
  "Bpmf Iansui",
  "Butterfly Kids",
  "Calligraffitti",
  "Caramel",
  "Carattere",
  "Cause",
  "Caveat Brush",
  "Cedarville Cursive",
  "Charm",
  "Charmonman",
  "Cherish",
  "Chilanka",
  "Clicker Script",
  "Comforter",
  "Comforter Brush",
  "Comic Neue",
  "Coming Soon",
  "Condiment",
  "Cookie",
  "Corinthia",
  "Courgette",
  "Covered By Your Grace",
  "Crafty Girls",
  "Damion",
  "Dawning of a New Day",
  "Dekko",
  "Delicious Handrawn",
  "Delius",
  "Delius Swash Caps",
  "Delius Unicase",
  "Devonshire",
  "Dr Sugiyama",
  "Eagle Lake",
  "East Sea Dokdo",
  "Edu AU VIC WA NT Arrows",
  "Edu AU VIC WA NT Dots",
  "Edu AU VIC WA NT Guides",
  "Edu AU VIC WA NT Hand",
  "Edu AU VIC WA NT Pre",
  "Edu NSW ACT Cursive",
  "Edu NSW ACT Foundation",
  "Edu NSW ACT Hand Pre",
  "Edu QLD Beginner",
  "Edu QLD Hand",
  "Edu SA Beginner",
  "Edu SA Hand",
  "Edu TAS Beginner",
  "Edu VIC WA NT Beginner",
  "Edu VIC WA NT Hand",
  "Edu VIC WA NT Hand Pre",
  "Engagement",
  "Ephesis",
  "Estonia",
  "Euphoria Script",
  "Explora",
  "Felipa",
  "Festive",
  "Fleur De Leah",
  "Fondamento",
  "Fuggles",
  "Fuzzy Bubbles",
  "Gaegu",
  "Gamja Flower",
  "Give You Glory",
  "Gloria Hallelujah",
  "Gochi Hand",
  "Grand Hotel",
  "Grape Nuts",
  "Great Vibes",
  "Grechen Fuemen",
  "Grey Qo",
] as const

function toFontId(label: string, category: FontCategory) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${category}-${slug || "font"}`
}

function makeCss(label: string, category: FontCategory) {
  if (label === "Doto") return "var(--font-doto), 'Doto', sans-serif"
  const quoted = `'${label.replace(/'/g, "\\'")}'`
  if (category === "serif") return `${quoted}, serif`
  if (category === "mono") return `${quoted}, ui-monospace, monospace`
  if (category === "script") return `${quoted}, cursive`
  return `${quoted}, sans-serif`
}

function buildFontOptions(
  labels: readonly string[],
  category: FontCategory
): FontFamilyOption[] {
  return labels.slice(0, 100).map((label) => ({
    id: toFontId(label, category),
    label,
    css: makeCss(label, category),
    category,
  }))
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  ...buildFontOptions(SANS_FONT_LABELS, "sans"),
  ...buildFontOptions(SERIF_FONT_LABELS, "serif"),
  ...buildFontOptions([...GOOGLE_MONO_LABELS, ...EXTRA_MONO_LABELS], "mono"),
  ...buildFontOptions(SCRIPT_FONT_LABELS, "script"),
  {
    id: "system-serif",
    label: "System Serif",
    css: "Georgia, 'Times New Roman', serif",
    category: "system",
  },
  {
    id: "system-ui",
    label: "System UI",
    css: "system-ui, sans-serif",
    category: "system",
  },
]

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
  originalScreenshot: string | null
  lastCropRegion: CropRegion | null
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
  screenshotLayer: ScreenshotLayer
  shadow: Shadow
  overlay: Overlay
  frame: DeviceFrame
  portrait: Portrait
  texts: TextElement[]
  assets: AssetElement[]
  enhance: EnhancePreset
  annotation: Annotation
  annotations: AnnotationStroke[]
  annotationShapes: AnnotationShape[]
}

export type EnhancePreset =
  | "off"
  | "auto"
  | "vivid"
  | "soft"
  | "dramatic"
  | "sharp"

export type AnnotationMode =
  | "pen"
  | "highlight"
  | "eraser"
  | "arrow"
  | "rect"
  | "ellipse"
  | "blur"

export type Annotation = {
  mode: AnnotationMode
  color: string
  strokeWidth: number
  lineStyle: AnnotationLineStyle
  blurEffect: AnnotationBlurEffect
  blurAmount: number
}

export type AnnotationLineStyle = "solid" | "dashed" | "dotted"
export type AnnotationBlurEffect =
  | "blur"
  | "redact"
  | "redact-light"
  | "redact-stripe"
  | "pixelate"

export type AnnotationPoint = {
  x: number
  y: number
}

export type AnnotationStroke = {
  id: string
  mode: Extract<AnnotationMode, "pen" | "highlight" | "eraser">
  color: string
  strokeWidth: number
  points: AnnotationPoint[]
}

export type AnnotationShapeKind = Extract<
  AnnotationMode,
  "arrow" | "rect" | "ellipse" | "blur"
>

export type AnnotationShape = {
  id: string
  kind: AnnotationShapeKind
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  rotation: number
  color: string
  strokeWidth: number
  lineStyle: AnnotationLineStyle
  blurEffect?: AnnotationBlurEffect
  blurAmount?: number
  zIndex: number
  opacity?: number
  blendMode?: AssetBlendMode
  hidden?: boolean
}

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

const OVERLAY_BASE_URL =
  process.env.NEXT_PUBLIC_OVERLAYS_BASE_URL ??
  "https://pub-4a1f61370c844ff69cc9d1a7b3689d25.r2.dev/overlays"

export function overlayUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/${String(id).padStart(3, "0")}.png`
}

export function overlayThumbUrl(id: number): string {
  return `${OVERLAY_BASE_URL}/thumbs/${String(id).padStart(3, "0")}.webp`
}

export type GradientCategory = {
  key: string
  label: string
  items: string[]
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
  originalScreenshot: null,
  lastCropRegion: null,
  aspect: { id: "auto", w: 0, h: 0 },
  background: {
    type: "image",
    value: DEFAULT_IMAGE_BACKGROUND,
  },
  padding: 96,
  borderRadius: 12,
  canvasBorderRadius: 16,
  border: { color: null, width: 1, style: "solid", padding: 0 },
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
    filter: "none",
  },
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  canvasZoom: 100,
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
  screenshotLayer: {
    zIndex: 1,
    opacity: 100,
    blendMode: "normal",
    hidden: false,
  },
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
  frame: {
    id: "none",
    color: "black",
    orientation: "vertical",
  },
  portrait: {
    mode: "off",
    intensity: 60,
  },
  texts: [],
  assets: [],
  enhance: "off",
  annotation: {
    mode: "pen",
    color: "#ef4444",
    strokeWidth: 4,
    lineStyle: "solid",
    blurEffect: "blur",
    blurAmount: 14,
  },
  annotations: [],
  annotationShapes: [],
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

type SetPatch =
  | Partial<EditorState>
  | ((state: EditorState) => Partial<EditorState>)

type Action =
  | { type: "SET"; patch: SetPatch; group: string | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" }

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "SET": {
      const patch =
        typeof action.patch === "function"
          ? action.patch(state.present)
          : action.patch
      const present = { ...state.present, ...patch }
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
  applyCroppedScreenshot: (s: string, region: CropRegion) => void
  setAspect: (a: AspectState) => void
  setBackground: (b: Background) => void
  setPadding: (n: number) => void
  setBorderRadius: (n: number) => void
  setCanvasBorderRadius: (n: number) => void
  setBorder: (b: Border) => void
  setBackdropEffects: (e: BackdropEffects) => void
  setBackdropPattern: (p: BackdropPattern) => void
  setBackdropFilter: (f: AssetFilter) => void
  setTilt: (t: Tilt) => void
  setScale: (n: number) => void
  setCanvasZoom: (n: number) => void
  setScreenshotPosition: (p: ScreenshotPosition) => void
  setScreenshotOffset: (o: { x: number; y: number }) => void
  updateScreenshotLayer: (patch: Partial<ScreenshotLayer>) => void
  setShadow: (s: Shadow) => void
  setOverlay: (o: Overlay) => void
  setFrame: (f: DeviceFrame) => void
  setPortrait: (p: Portrait) => void
  setEnhance: (e: EnhancePreset) => void
  setAnnotation: (patch: Partial<Annotation>) => void
  addAnnotationStroke: (stroke: Omit<AnnotationStroke, "id">) => string
  updateAnnotationStroke: (id: string, points: AnnotationPoint[]) => void
  addAnnotationShape: (shape: Omit<AnnotationShape, "id" | "zIndex">) => string
  updateAnnotationShape: (id: string, patch: Partial<AnnotationShape>) => void
  deleteAnnotationShape: (id: string) => void
  duplicateAnnotationShape: (id: string) => string | null
  bringAnnotationShapeToFront: (id: string) => void
  sendAnnotationShapeToBack: (id: string) => void
  clearAnnotations: () => void
  addText: () => string
  updateText: (id: string, patch: Partial<TextElement>) => void
  deleteText: (id: string) => void
  duplicateText: (id: string) => string | null
  bringTextToFront: (id: string) => void
  sendTextToBack: (id: string) => void
  selectedTextId: string | null
  setSelectedTextId: (id: string | null) => void
  addAsset: (src: string) => string
  updateAsset: (id: string, patch: Partial<AssetElement>) => void
  deleteAsset: (id: string) => void
  duplicateAsset: (id: string) => string | null
  bringAssetToFront: (id: string) => void
  sendAssetToBack: (id: string) => void
  selectedAssetId: string | null
  setSelectedAssetId: (id: string | null) => void
  selectedAnnotationShapeId: string | null
  setSelectedAnnotationShapeId: (id: string | null) => void
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
  const [selectedTextId, setSelectedTextId] = React.useState<string | null>(
    null
  )
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(
    null
  )
  const [selectedAnnotationShapeId, setSelectedAnnotationShapeId] =
    React.useState<string | null>(null)

  const value: Ctx = React.useMemo(() => {
    const set = (patch: SetPatch, group: string | null) =>
      dispatch({ type: "SET", patch, group })
    const makeId = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const computeNextZ = (items: { zIndex: number }[]) => {
      const max = items.length ? Math.max(...items.map((t) => t.zIndex)) : 0
      return Math.max(max + 1, 1)
    }
    const getLayerItems = (s: EditorState) => [
      s.screenshotLayer,
      ...s.assets,
      ...s.texts,
      ...s.annotationShapes,
    ]
    const computeNextLayerZ = (s: EditorState) => computeNextZ(getLayerItems(s))
    const getLayerRefs = (s: EditorState) => [
      { key: "screenshot", zIndex: s.screenshotLayer.zIndex },
      ...s.assets.map((asset) => ({
        key: `asset:${asset.id}`,
        zIndex: asset.zIndex,
      })),
      ...s.texts.map((text) => ({
        key: `text:${text.id}`,
        zIndex: text.zIndex,
      })),
      ...s.annotationShapes.map((shape) => ({
        key: `annotation:${shape.id}`,
        zIndex: shape.zIndex,
      })),
    ]
    const applyLayerOrder = (
      s: EditorState,
      refsBottomFirst: { key: string; zIndex: number }[]
    ): Partial<EditorState> => {
      const zByKey = new Map(
        refsBottomFirst.map((layer, index) => [layer.key, index + 1])
      )
      return {
        screenshotLayer: {
          ...s.screenshotLayer,
          zIndex: zByKey.get("screenshot") ?? s.screenshotLayer.zIndex,
        },
        assets: s.assets.map((asset) => ({
          ...asset,
          zIndex: zByKey.get(`asset:${asset.id}`) ?? asset.zIndex,
        })),
        texts: s.texts.map((text) => ({
          ...text,
          zIndex: zByKey.get(`text:${text.id}`) ?? text.zIndex,
        })),
        annotationShapes: s.annotationShapes.map((shape) => ({
          ...shape,
          zIndex: zByKey.get(`annotation:${shape.id}`) ?? shape.zIndex,
        })),
      }
    }
    const moveLayerInStack = (
      s: EditorState,
      key: string,
      position: "front" | "back"
    ): Partial<EditorState> => {
      const refs = getLayerRefs(s).sort((a, b) => a.zIndex - b.zIndex)
      const index = refs.findIndex((layer) => layer.key === key)
      if (index < 0) return {}
      const [target] = refs.splice(index, 1)
      if (position === "front") refs.push(target)
      else refs.unshift(target)
      return applyLayerOrder(s, refs)
    }
    return {
      ...DEFAULT_STATE,
      ...state.present,
      setActiveTool: (t) => set({ activeTool: t }, null),
      setScreenshot: (screenshot) =>
        set(
          (s) => ({
            screenshot,
            originalScreenshot: screenshot,
            lastCropRegion: null,
            screenshotPosition: "center",
            screenshotOffset: { x: 0, y: 0 },
            screenshotLayer: {
              ...s.screenshotLayer,
              zIndex:
                screenshot && !s.screenshot
                  ? computeNextLayerZ(s)
                  : s.screenshotLayer.zIndex,
              hidden: false,
            },
          }),
          null
        ),
      applyCroppedScreenshot: (s, region) =>
        set(
          { screenshot: s, lastCropRegion: region },
          "applyCroppedScreenshot"
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
      setBackdropFilter: (f) =>
        set(
          { backdrop: { ...state.present.backdrop, filter: f } },
          "backdrop-filter"
        ),
      setTilt: (t) => set({ tilt: t }, "tilt"),
      setScale: (n) => set({ scale: n }, "scale"),
      setCanvasZoom: (n) => set({ canvasZoom: n }, "canvasZoom"),
      setScreenshotPosition: (p) =>
        set(
          { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
          "screenshotPosition"
        ),
      setScreenshotOffset: (o) =>
        set({ screenshotOffset: o }, "screenshotOffset"),
      updateScreenshotLayer: (patch) =>
        set(
          (s) => ({
            screenshotLayer: { ...s.screenshotLayer, ...patch },
          }),
          "screenshotLayer"
        ),
      setShadow: (s) => set({ shadow: s }, "shadow"),
      setOverlay: (o) => set({ overlay: o }, "overlay"),
      setFrame: (f) => set({ frame: f }, "frame"),
      setPortrait: (p) => set({ portrait: p }, "portrait"),
      setEnhance: (e) => set({ enhance: e }, "enhance"),
      setAnnotation: (patch) =>
        set(
          (s) => ({ annotation: { ...s.annotation, ...patch } }),
          "annotation"
        ),
      addAnnotationStroke: (stroke) => {
        const id = makeId()
        set(
          (s) => ({
            annotations: [...s.annotations, { ...stroke, id }],
          }),
          `annotation-stroke-${id}`
        )
        return id
      },
      updateAnnotationStroke: (id, points) =>
        set(
          (s) => ({
            annotations: s.annotations.map((stroke) =>
              stroke.id === id ? { ...stroke, points } : stroke
            ),
          }),
          `annotation-stroke-${id}`
        ),
      addAnnotationShape: (shape) => {
        const id = makeId()
        set(
          (s) => ({
            annotationShapes: [
              ...s.annotationShapes,
              { ...shape, id, zIndex: computeNextLayerZ(s) },
            ],
          }),
          null
        )
        return id
      },
      updateAnnotationShape: (id, patch) =>
        set(
          (s) => ({
            annotationShapes: s.annotationShapes.map((shape) =>
              shape.id === id ? { ...shape, ...patch } : shape
            ),
          }),
          `annotation-shape-${id}`
        ),
      deleteAnnotationShape: (id) => {
        set(
          (s) => ({
            annotationShapes: s.annotationShapes.filter(
              (shape) => shape.id !== id
            ),
          }),
          null
        )
      },
      duplicateAnnotationShape: (id) => {
        const copyId = makeId()
        let didCopy = false
        set((s) => {
          const src = s.annotationShapes.find((shape) => shape.id === id)
          if (!src) return { annotationShapes: s.annotationShapes }
          didCopy = true
          const copy: AnnotationShape = {
            ...src,
            id: copyId,
            xPct: Math.min(98, src.xPct + 3),
            yPct: Math.min(98, src.yPct + 3),
            zIndex: computeNextLayerZ(s),
          }
          return { annotationShapes: [...s.annotationShapes, copy] }
        }, null)
        return didCopy ? copyId : null
      },
      bringAnnotationShapeToFront: (id) => {
        set((s) => moveLayerInStack(s, `annotation:${id}`, "front"), null)
      },
      sendAnnotationShapeToBack: (id) => {
        set((s) => moveLayerInStack(s, `annotation:${id}`, "back"), null)
      },
      clearAnnotations: () =>
        set({ annotations: [], annotationShapes: [] }, null),
      addText: () => {
        const id = makeId()
        set(
          (s) => ({
            texts: [
              ...s.texts,
              {
                id,
                content: "Double-click to edit",
                xPct: 50,
                yPct: 85,
                rotation: 0,
                fontSize: 18,
                fontFamily: FONT_FAMILIES[0].css,
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: 0,
                color: "#ffffff",
                align: "left",
                borderColor: null,
                borderWidth: 1,
                borderStyle: "solid",
                zIndex: computeNextLayerZ(s),
                widthPx: null,
                heightPx: null,
                autoColor: true,
                opacity: 100,
                blendMode: "normal",
              },
            ],
          }),
          null
        )
        return id
      },
      updateText: (id, patch) => {
        set(
          (s) => ({
            texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          }),
          `text-${id}`
        )
      },
      deleteText: (id) => {
        set((s) => ({ texts: s.texts.filter((t) => t.id !== id) }), null)
      },
      duplicateText: (id) => {
        const copyId = makeId()
        set((s) => {
          const src = s.texts.find((t) => t.id === id)
          if (!src) return { texts: s.texts }
          const copy: TextElement = {
            ...src,
            id: copyId,
            xPct: Math.min(95, src.xPct + 4),
            yPct: Math.min(95, src.yPct + 4),
            zIndex: computeNextLayerZ(s),
          }
          return { texts: [...s.texts, copy] }
        }, null)
        return copyId
      },
      bringTextToFront: (id) => {
        set((s) => moveLayerInStack(s, `text:${id}`, "front"), null)
      },
      sendTextToBack: (id) => {
        set((s) => moveLayerInStack(s, `text:${id}`, "back"), null)
      },
      selectedTextId,
      setSelectedTextId,
      addAsset: (src) => {
        const id = makeId()
        set(
          (s) => ({
            assets: [
              ...s.assets,
              {
                id,
                src,
                xPct: 50,
                yPct: 50,
                widthPct: 25,
                heightPct: null,
                rotation: 0,
                zIndex: computeNextLayerZ(s),
                opacity: 100,
                filter: "none",
                blendMode: "normal",
                hidden: false,
              },
            ],
          }),
          null
        )
        return id
      },
      updateAsset: (id, patch) => {
        set(
          (s) => ({
            assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          }),
          `asset-${id}`
        )
      },
      deleteAsset: (id) => {
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }), null)
      },
      duplicateAsset: (id) => {
        const copyId = makeId()
        let didCopy = false
        set((s) => {
          const src = s.assets.find((a) => a.id === id)
          if (!src) return { assets: s.assets }
          didCopy = true
          const copy: AssetElement = {
            ...src,
            id: copyId,
            xPct: Math.min(95, src.xPct + 4),
            yPct: Math.min(95, src.yPct + 4),
            zIndex: computeNextLayerZ(s),
          }
          return { assets: [...s.assets, copy] }
        }, null)
        return didCopy ? copyId : null
      },
      bringAssetToFront: (id) => {
        set((s) => moveLayerInStack(s, `asset:${id}`, "front"), null)
      },
      sendAssetToBack: (id) => {
        set((s) => moveLayerInStack(s, `asset:${id}`, "back"), null)
      },
      selectedAssetId,
      setSelectedAssetId,
      selectedAnnotationShapeId,
      setSelectedAnnotationShapeId,
      reset: () => dispatch({ type: "RESET" }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      isPreviewMode,
      setIsPreviewMode,
    }
  }, [
    state,
    isPreviewMode,
    selectedTextId,
    selectedAssetId,
    selectedAnnotationShapeId,
  ])

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

export function enhanceFilterCss(preset: EnhancePreset): string | undefined {
  switch (preset) {
    case "auto":
      return "brightness(1.04) contrast(1.08) saturate(1.1)"
    case "vivid":
      return "brightness(1.05) contrast(1.12) saturate(1.35)"
    case "soft":
      return "brightness(1.06) contrast(0.96) saturate(0.9)"
    case "dramatic":
      return "brightness(0.98) contrast(1.25) saturate(1.2)"
    case "sharp":
      return "brightness(1.02) contrast(1.18) saturate(1.05)"
    case "off":
    default:
      return undefined
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
    let dx = 0,
      dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) {
        dx = -(c - 2)
        dy = -(r - 2)
      }
    }
    const unit = intensity * 10
    const blur = 40 + intensity * 80
    const spread = intensity * 4
    const opacity = 0.1 + intensity * 0.2
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread.toFixed(1)}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "hard") {
    let dx = 0,
      dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) {
        dx = -(c - 2)
        dy = -(r - 2)
      }
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
  let dx = 0,
    dy = 0
  if (shadow.lightSource !== "center") {
    const [r, c] = shadow.lightSource.split("-").map(Number)
    if (Number.isFinite(r) && Number.isFinite(c)) {
      dx = -(c - 2)
      dy = -(r - 2)
    }
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
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
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
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
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

function srgbChannel(c: number): number {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  )
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
        reject(err)
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = url
  })
  imageLuminanceCache.set(url, result)
  return result
}

export async function pickContrastColor(
  screenshot: string | null,
  background: Background
): Promise<string> {
  // Fallback: prioritize background luminance for text contrast.
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

/**
 * Sample image luminance at a specific region (relX, relY in 0–1 range).
 * Samples a small area around the point for a reliable reading.
 */
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
        reject(err)
      }
    }
    img.onerror = () => reject(new Error("image load failed"))
    img.src = url
  })
}

/**
 * Position-aware contrast color picker.
 * Uses `elementsFromPoint` to detect whether the text sits over the screenshot
 * or the background, then samples the correct source at that exact region.
 */
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

    // Find all elements stacked at this point (topmost first)
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
  }

  // Not over screenshot or no canvas — fall back to background-based detection
  return pickContrastColor(null, background)
}
