export type AspectState = { id: string; w: number; h: number }

export type CropRegion = { x: number; y: number; width: number; height: number }

export type BgType = "none" | "solid" | "gradient" | "image" | "auto"

export type Background = {
  type: BgType
  /**
   * The image/paint value used by the live canvas. For image backgrounds this
   * should be an editor-safe preview, not necessarily the original source.
   */
  value: string
  /** Original remote/library image URL, kept for selection identity. */
  sourceUrl?: string
  /** Tiny placeholder URL used while the editor-safe preview is generated. */
  thumbUrl?: string
}

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

export type BackdropLightingTarget = "outer" | "inner"

export type BackdropLighting = {
  target: BackdropLightingTarget
  intensity: number
  direction: string
  color: string
}

export type Backdrop = {
  effects: BackdropEffects
  pattern: BackdropPattern
  lighting: BackdropLighting
  filter: AssetFilter
}

export type ShadowType =
  | "none"
  | "drop"
  | "soft"
  | "hard"
  | "glow"
  | "float"
  | "linear"

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

export type PortraitMode =
  | "off"
  | "soft"
  | "studio"
  | "spot"
  | "frame"
  | "iris"
  | "blur"
  | "stage"

export type Portrait = {
  mode: PortraitMode
  intensity: number
  position: number
  distance: number
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
  flipX?: boolean
  flipY?: boolean
}

export type ScreenshotLayer = {
  zIndex: number
  opacity: number
  blendMode: AssetBlendMode
  hidden: boolean
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
  strokeColor?: string | null
  strokeWidth?: number
  textShadow?: string | null
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
  | "step"

export type AnnotationLineStyle = "solid" | "dashed" | "dotted"

export type AnnotationBlurEffect =
  | "blur"
  | "redact"
  | "redact-light"
  | "redact-stripe"
  | "pixelate"

export type Annotation = {
  mode: AnnotationMode
  color: string
  strokeWidth: number
  lineStyle: AnnotationLineStyle
  blurEffect: AnnotationBlurEffect
  blurAmount: number
}

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
  zIndex: number
  opacity?: number
  blendMode?: AssetBlendMode
  hidden?: boolean
}

export type AnnotationShapeKind = Extract<
  AnnotationMode,
  "arrow" | "rect" | "ellipse" | "blur" | "step"
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
  stepNumber?: number
  zIndex: number
  opacity?: number
  blendMode?: AssetBlendMode
  hidden?: boolean
}

export type BackgroundEntry = {
  id: string
  name: string
  full: string
  preview?: string
  thumb: string
}

export type BackgroundCategory = {
  key: string
  label: string
  items: BackgroundEntry[]
}

export type GradientCategory = {
  key: string
  label: string
  items: string[]
}

// Shared canvas-level styling (padding, frame, shadow, border, enhance, etc.)
// is read directly from CanvasState. Slots only carry per-instance data:
// position/size, per-slot tilt/scale/rotation (used by layout presets),
// image source, filter, fit, and stacking.
export type ScreenshotSlot = {
  id: string
  src: string | null
  originalSrc?: string | null
  lastCropRegion?: CropRegion | null
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  rotation: number
  tilt: Tilt
  scale: number
  zIndex: number
  filter: AssetFilter
  hidden?: boolean
  objectFit?: "contain" | "cover" | "fill"
  border?: Border
  borderRadius?: number
  padding?: number
  shadow?: Shadow
  lighting?: BackdropLighting
}

export type CanvasPosition = { x: number; y: number }

export type TweetAuthor = {
  name: string
  handle: string
  avatarUrl: string
  verified: boolean
}

export type TweetMedia = {
  type: "photo"
  url: string
  width?: number
  height?: number
  alt?: string
}

export type TweetLinkPreview = {
  url: string
  title: string
  description?: string
  domain?: string
  image?: TweetMedia
}

export type TweetData = {
  source: "x" | "bluesky"
  id: string
  url: string
  text: string
  author: TweetAuthor
  createdAt: string
  media?: TweetMedia[]
  linkPreview?: TweetLinkPreview
  quotedTweet?: TweetData
  // The public syndication endpoint exposes likes/replies/reposts more often
  // than views. Views are optional and only shown when X returns them.
  metrics: { likes: number; replies: number; reposts: number; views?: number }
}

export type TweetTheme = "light" | "dim" | "dark"

export type TweetCard = {
  data: TweetData
  theme: TweetTheme
  showMetrics: boolean
  showAvatar: boolean
  showImages?: boolean
  showTimestamp?: boolean
  showQuote?: boolean
  fontFamily?: string
  fontSize?: number
}

export type CanvasState = {
  id: string
  position: CanvasPosition
  screenshot: string | null
  originalScreenshot: string | null
  lastCropRegion: CropRegion | null
  background: Background
  padding: number
  borderRadius: number
  canvasBorderRadius: number
  border: Border
  backdrop: Backdrop
  tilt: Tilt
  scale: number
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
  annotations: AnnotationStroke[]
  annotationShapes: AnnotationShape[]
  screenshotSlots: ScreenshotSlot[]
  frameAddress: string
  // An X/Twitter post rendered as the canvas's main content. Mutually
  // exclusive with `screenshot`: setting one clears the other.
  tweet: TweetCard | null
  objectFit?: "contain" | "cover" | "fill"
  aspect?: AspectState
}

export type EditorState = {
  activeTool: EditorTool
  aspect: AspectState
  canvasZoom: number
  annotation: Annotation
  canvases: CanvasState[]
  activeCanvasId: string
}
