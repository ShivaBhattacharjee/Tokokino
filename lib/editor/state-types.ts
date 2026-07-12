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

/**
 * Which screenshot on the canvas a clip animates.
 *  - "all": every screenshot (main + all slots) — used when nothing is selected.
 *  - "main": just the primary screenshot.
 *  - "slot": one extra screenshot slot, identified by id.
 * Mirrors ScreenshotStyleTarget (screenshot-style-target.ts) so a clip binds to
 * whatever screenshot was selected when it was added.
 */
export type AnimationClipTarget =
  | { scope: "all" }
  | { scope: "main" }
  | { scope: "slot"; slotId: string }

/**
 * An animatable effect a keyframe can "own". A keyframe animates (and shows an
 * icon for) exactly the effects in its `effects` set — the ones you changed while
 * it was selected. These strings double as the timeline clip's icon keys.
 */
export type AnimationEffect =
  | "position"
  | "zoom"
  | "tilt"
  | "padding"
  | "shadow"
  | "background"
  | "backdrop"
  | "canvasRadius"
  | "lighting"
  | "filter"
  | "portrait"
  | "pattern"
  | "overlay"
  | "border"
  | "borderRadius"

/** The selectable per-clip transition curves (see `clip-easing.ts`). */
export type ClipEasingKind =
  | "linear"
  | "cubic"
  | "in"
  | "out"
  | "inOut"
  | "outCirc"

/** A screenshot's animatable transform, captured for a clip's baseline. */
export type ClipSlotPose = {
  tilt: Tilt
  scale: number
  rotation: number
  /** Optional so older drafts (transform-only slot poses) still load. */
  shadow?: Shadow
  /**
   * Slot centre position as a % of the canvas (matches ScreenshotSlot.xPct/yPct).
   * Optional so drafts saved before slot position was animatable hydrate cleanly
   * (read through a fallback to the live slot position).
   */
  xPct?: number
  yPct?: number
  /**
   * Slot border / corner radius / padding / lighting at this keyframe. All
   * optional so drafts saved before these were animatable per slot hydrate
   * cleanly (read through a fallback to the live slot / canvas value).
   */
  border?: Border
  borderRadius?: number
  padding?: number
  lighting?: BackdropLighting
}

/**
 * A full snapshot of the canvas's animatable state — used as a clip's target
 * keyframe (`pose`). Playback interpolates the previous keyframe's pose → this
 * clip's pose; the first clip reveals from a neutral rest pose. Editing the
 * canvas while a clip is selected updates that clip's pose only.
 */
export type ClipBaseline = {
  tilt: Tilt
  scale: number
  screenshotPosition: ScreenshotPosition
  screenshotOffset: { x: number; y: number }
  padding: number
  /** Outer canvas corner radius (0–80). */
  canvasBorderRadius: number
  shadow: Shadow
  backdropEffects: BackdropEffects
  /**
   * Backdrop lighting at this keyframe. Optional so drafts saved before lighting
   * was animatable hydrate cleanly (read through a fallback to the live value).
   */
  lighting?: BackdropLighting
  background: Background
  /**
   * Backdrop filter (AssetFilter preset) at this keyframe. Optional so drafts
   * saved before filters were animatable hydrate cleanly (read through a
   * fallback to the live value).
   */
  filter?: AssetFilter
  /**
   * Backdrop portrait (depth-of-field) at this keyframe. Optional so drafts
   * saved before portrait was animatable hydrate cleanly.
   */
  portrait?: Portrait
  /**
   * Backdrop pattern (geometric texture overlay) at this keyframe. Optional so
   * drafts saved before pattern was animatable hydrate cleanly.
   */
  pattern?: BackdropPattern
  /**
   * Texture overlay (over/under the screenshot) at this keyframe. Optional so
   * drafts saved before overlay was animatable hydrate cleanly.
   */
  overlay?: Overlay
  /**
   * Screenshot border (color/width/style/inner padding) at this keyframe.
   * Optional so drafts saved before border was animatable hydrate cleanly.
   */
  border?: Border
  /**
   * Screenshot corner radius (0–48) at this keyframe. Optional so drafts saved
   * before it was animatable hydrate cleanly (read through a live fallback).
   */
  borderRadius?: number
  /** Per-slot poses keyed by slot id. */
  slots: Record<string, ClipSlotPose>
}

/** A single motion layer placed on the animation timeline. */
export type AnimationClip = {
  id: string
  startMs: number
  durationMs: number
  /**
   * The screenshot this clip animates. Optional so drafts saved before per-clip
   * targeting hydrate cleanly — read through a helper that defaults to "all".
   */
  target?: AnimationClipTarget
  /**
   * This clip's target keyframe — the look the screenshot animates TO by the end
   * of the clip. Set when the clip is added (snapshot of the current canvas) and
   * updated as you edit the canvas while the clip is selected.
   */
  pose?: ClipBaseline
  /**
   * The effects this keyframe explicitly owns — the properties you changed while
   * it was selected. ONLY these animate and show icons; everything else holds the
   * value from the previous keyframe. Empty/undefined = a passive keyframe that
   * animates nothing yet.
   */
  effects?: AnimationEffect[]
  /**
   * Legacy add-time snapshot from the pre-keyframe model. Kept optional so older
   * drafts hydrate cleanly; read through `clipPose`, which prefers `pose`.
   */
  baseline?: ClipBaseline
  /**
   * Transition curve this clip eases its owned effects with. Optional so drafts
   * saved before per-clip easing hydrate cleanly — read through `clipEasingKind`,
   * which defaults to the historic ease-out. See `clip-easing.ts`.
   */
  easing?: ClipEasingKind
  /**
   * Speed remap (1..5): how quickly the transition completes WITHIN the clip's
   * window without moving its keyframe time. 1 = uses the full window; higher
   * finishes proportionally sooner then holds the pose. Read through `clipSpeed`.
   */
  speed?: number
}

export type CanvasAnimation = {
  /** Total timeline length in ms. */
  durationMs: number
  clips: AnimationClip[]
}

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
  // Animate-mode motion timeline. Optional so drafts saved before this feature
  // hydrate cleanly (normalized to a default on load).
  animation?: CanvasAnimation
}

export type EditorState = {
  activeTool: EditorTool
  aspect: AspectState
  canvasZoom: number
  annotation: Annotation
  canvases: CanvasState[]
  activeCanvasId: string
}
