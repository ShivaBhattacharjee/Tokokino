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

export type ShadowType = "none" | "drop" | "soft" | "hard" | "glow" | "float" | "linear"

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

export type GradientCategory = {
  key: string
  label: string
  items: string[]
}

export type ScreenshotSlot = {
  id: string
  src: string | null
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  rotation: number
  padding: number
  tilt: Tilt
  scale: number
  frame: DeviceFrame
  borderRadius: number
  zIndex: number
  shadow: Shadow
  border: Border
  enhance: EnhancePreset
  filter: AssetFilter
  opacity: number
  blendMode: AssetBlendMode
  hidden?: boolean
  frameAddress: string
  objectFit?: "contain" | "cover" | "fill"
}

export type CanvasPosition = { x: number; y: number }

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
  objectFit?: "contain" | "cover" | "fill"
}

export type EditorState = {
  activeTool: EditorTool
  aspect: AspectState
  canvasZoom: number
  annotation: Annotation
  canvases: CanvasState[]
  activeCanvasId: string
}
