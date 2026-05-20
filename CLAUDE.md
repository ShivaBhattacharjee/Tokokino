# CLAUDE.md — Tokokino 

## Project overview

**Tokokino** is a browser-based screenshot beautifier. Users drop in a screenshot, style it with backgrounds, shadows, device frames, text layers, and annotations, then export as PNG/JPEG/WebP or share a public link. The app is fully client-side for editing; the server handles auth, share uploads to R2, and view tracking in MongoDB.

**Stack:**
- Next.js 16.1.7 (App Router) + React 19, Turbopack in dev
- Zustand 5 for all editor state, with undo/redo and IndexedDB persistence
- Tailwind CSS v4 + shadcn components + Radix UI primitives
- better-auth (email + Google OAuth), MongoDB, Cloudflare R2 (via AWS S3 SDK)
- `html-to-image` for canvas capture, `motion` for animation, `@dnd-kit` for drag-and-drop
- Zod v4 (`zod/v4`) for input validation
- TypeScript strict mode

---

## Dev commands

```bash
pnpm dev          # starts Next.js with Turbopack
pnpm build        # production build
pnpm typecheck    # tsc --noEmit (run before committing)
pnpm lint:fix     # ESLint auto-fix
pnpm format       # Prettier on all .ts/.tsx
```

Asset build scripts (run once after adding overlays/backgrounds):
```bash
pnpm build:thumbs                 # overlay thumbnails
pnpm build:device-mockup-thumbs   # device frame thumbnails
pnpm build:backgrounds            # background thumbnails
```

---

## Directory structure

```
/app                      Next.js App Router pages
  /app/page.tsx           Main editor page (EditorLayout)
  /app/share/page.tsx     User's share history
  /app/layout.tsx         App shell (providers)
  /api/share/route.ts     POST: create share link
  /api/auth/[...all]      better-auth handler
  /api/export/image       CORS proxy for external images
  /api/unsplash/*         Unsplash search + download
  /login/                 Auth pages
  /share/[id]/            Public share view
  /terms/                 Terms of service

/components/editor/       All editor UI (see Editor Components below)
/components/ui/           shadcn component library
/lib/editor/              Core editor logic
  store.tsx               Zustand store — all state & actions
  state-types.ts          All TypeScript types
  export.ts               Image capture & export
  css-utils.ts            CSS generation (shadows, filters, backgrounds)
  color-utils.ts          Color sampling & gradient generation
  fonts.ts                Google Fonts catalogue (100+ fonts)
  presets.ts              Gradient/solid/overlay presets
  present-presets.ts      Multi-screenshot layout presets + single tilt presets
  screenshot-layout.ts    Row layout algorithm for multi-screenshot
  value-schemas.ts        Zod schemas for all numeric inputs
  types.ts                Misc types
/lib/
  auth.ts                 better-auth server instance
  auth-client.ts          Client-side auth hooks
  env.ts                  Environment variable validation
  share.ts                Share URL helpers, UUID validation
  share-db.ts             MongoDB share CRUD
  share-storage.ts        R2 upload/download
  browser-frame.ts        Browser frame constants (Safari/Chrome/Arc)
  mongo.ts                MongoDB client singleton
/hooks/
  use-floating-toolbar-rect.ts  Toolbar positioning hook
```

---

## Editor state — Zustand store (`lib/editor/store.tsx`)

The entire editor state lives in one Zustand store with temporal middleware for undo/redo.

### Top-level state shape

```ts
{
  // Editor UI
  activeTool: EditorTool            // "pointer"|"crop"|"text"|"arrow"|"position"|"layers"|"enhance"
  aspect: AspectState               // { id, w, h } — canvas aspect ratio
  canvasZoom: number                // editor viewport zoom (not the screenshot scale)
  annotation: Annotation            // current annotation tool state

  // Preview / bulk edit
  isPreviewMode: boolean
  isPreviewAutoScroll: boolean
  previewAutoScrollDelay: number
  previewAnimation: "slide"|"fade"|"zoom"|"flip"
  bulkEditMode: boolean
  bulkCanvasDragging: boolean
  bulkViewportZoom: number

  // Layout preset tracking
  presetTab: "single"|"multi"
  activeLayoutPresetId: string | null   // multi-screenshot preset
  activeSinglePresetId: string | null   // single-screenshot tilt preset

  // Undo/redo wrapper — everything below is inside `present`
  past: EditorState[]     // max 100
  present: EditorState    // current state
  future: EditorState[]
}
```

### Canvas state (`CanvasState`) — the "screenshot box"

Each canvas is one styled screenshot card:

```ts
{
  id: string
  position: { x, y }            // position on the infinite bulk-edit canvas

  // Screenshot / image
  screenshot: string | null      // current image (may be cropped)
  originalScreenshot: string | null  // pre-crop backup
  lastCropRegion: CropRegion | null

  // Background
  background: Background         // { type: "none"|"solid"|"gradient"|"image"|"auto"; value }
                                 // "auto" generates gradient from screenshot colors

  // Canvas box styling
  padding: number                // 0–240 px
  borderRadius: number           // screenshot corner radius 0–48
  canvasBorderRadius: number     // outer canvas corner radius 0–80
  border: Border                 // { color, width 0–12, style, padding 0–80 }

  // Screenshot 3D transform
  tilt: Tilt                     // { rx, ry, rz } degrees — CSS 3D rotation
  scale: number                  // screenshot scale 10–300 %

  // Screenshot placement inside the canvas
  screenshotPosition: ScreenshotPosition  // "center" or grid string "0-0" … "4-4"
  screenshotOffset: { x, y }             // pixel offset from position
  objectFit: "contain"|"cover"|"fill"
  screenshotLayer: ScreenshotLayer        // { zIndex, opacity, blendMode, hidden }

  // Backdrop (behind the screenshot, inside padding)
  backdrop: Backdrop             // { effects, pattern, filter }

  // Visual effects on the screenshot
  shadow: Shadow                 // { type, intensity, lightSource, color }
  overlay: Overlay               // { id, opacity, position: "overlay"|"underlay" }
  frame: DeviceFrame             // { id, color, orientation: "vertical"|"horizontal" }
  portrait: Portrait             // { mode, intensity, position, distance }
  enhance: EnhancePreset         // "off"|"auto"|"vivid"|"soft"|"dramatic"|"sharp"

  // Additional layers
  texts: TextElement[]
  assets: AssetElement[]         // image/SVG layers
  annotations: AnnotationStroke[]
  annotationShapes: AnnotationShape[]

  // Multi-screenshot support (max 3 extra slots)
  screenshotSlots: ScreenshotSlot[]

  // Browser frame URL
  frameAddress: string
}
```

### Key numeric ranges (enforced by Zod in `value-schemas.ts`)

| Property | Min | Max |
|---|---|---|
| padding | 0 | 240 |
| borderRadius | 0 | 48 |
| canvasBorderRadius | 0 | 80 |
| borderWidth | 0 | 12 |
| borderInnerPadding | 0 | 80 |
| scale | 10 | 300 |
| opacity | 0 | 100 |
| blur | 0 | 20 |
| brightness / contrast / saturation | 0 | 200 |
| hue | -180 | 360 |
| degree (rotation/tilt) | -180 | 180 |
| positionPercent | -50 | 150 |
| shadowIntensity | 0 | 100 |

Always pass values through `clampNumber(val, min, max)` or the Zod schema before updating state.

### Multi-screenshot slots (`ScreenshotSlot`)

Up to 3 extra screenshots can be added per canvas. Each slot is a floating image card:

```ts
{
  id: string
  src: string | null
  xPct, yPct: number        // position as % of canvas dimensions
  widthPct, heightPct: number
  rotation: number
  tilt: Tilt
  scale: number
  zIndex: number
  filter: AssetFilter
  hidden?: boolean
  objectFit?: "contain"|"cover"|"fill"
}
```

`setScreenshotSlotImage(id, src)` respects the active layout preset — it calls `resolveLayoutPresetGeometry()` to determine position/tilt for the slot.

### Text elements (`TextElement`)

Free-floating text layers, positioned by `xPct`/`yPct` (percent of canvas):

```ts
{
  id, content, xPct, yPct, rotation,
  fontSize, fontFamily, fontWeight,
  lineHeight, letterSpacing, color,
  align: "left"|"center"|"right",
  borderColor, borderWidth, borderStyle,
  zIndex, widthPx, heightPx,
  autoColor, strokeColor, strokeWidth, textShadow,
  opacity, blendMode, hidden
}
```

### Asset elements (`AssetElement`)

Image/SVG layers also positioned by percent:

```ts
{
  id, src, xPct, yPct,
  widthPct, heightPct: number | null,
  rotation, zIndex, opacity,
  filter: AssetFilter, blendMode: AssetBlendMode,
  hidden, flipX, flipY
}
```

### Backdrop effects

```ts
BackdropEffects = {
  noise, blur, brightness, contrast,
  saturation, hue, grayscale, sepia, invert, opacity
}
BackdropPattern = { ids: number[], intensity, thickness, color }
```

### Shadows

```ts
ShadowType = "none"|"drop"|"soft"|"hard"|"glow"|"float"|"linear"
Shadow = { type, intensity, lightSource, color }
```

CSS is generated in `lib/editor/css-utils.ts` via `shadowCss()`.

### Portrait modes (depth-of-field effect)

```ts
PortraitMode = "off"|"soft"|"studio"|"spot"|"frame"|"iris"|"blur"|"stage"
Portrait = { mode, intensity, position, distance }
```

### Asset filters

`AssetFilter = "none"|"bw"|"sepia"|"vintage"|"warm"|"cool"|"fade"|"vivid"|"noir"|"dream"|"mono"|"invert"`

Applied via `assetFilterCss()` in `css-utils.ts`.

---

## Store actions (most-used)

```ts
// Canvas management
addCanvas()                              // returns new canvas id
removeCanvas(id)
duplicateCanvas(sourceId?)
setActiveCanvasId(id)

// Screenshot
setScreenshot(src, canvasId?)
applyCroppedScreenshot(src, region, canvasId?)
setObjectFit("contain"|"cover"|"fill", canvasId?)

// Styling
setBackground(bg, canvasId?)
setPadding(n)
setBorderRadius(n)
setCanvasBorderRadius(n)
setBorder(patch)
setTilt({ rx, ry, rz })
setScale(n)
setTiltAndScale(tilt, scale)            // single history entry
setShadow(patch)
setOverlay(patch)
setFrame(patch)
setPortrait(patch)
setEnhance("off"|"auto"|"vivid"|...)

// Backdrop
setBackdropEffects(effects)
setBackdropPattern(pattern)
setBackdropFilter(filter)

// Screenshot placement
setScreenshotPosition(pos)
setScreenshotOffset({ x, y })
setScreenshotPlacement(pos, offset)     // single history entry
updateScreenshotLayer(patch)
bringScreenshotToFront()
sendScreenshotToBack()

// Multi-screenshot slots
addScreenshotSlot()                     // returns slot id
deleteScreenshotSlot(id)
duplicateScreenshotSlot(id)
setScreenshotSlotImage(id, src)         // respects layout preset geometry
updateScreenshotSlot(id, patch)
arrangeScreenshotSlotsInRow()
setScreenshotSlotGroupPosition(pos)
bringScreenshotSlotToFront(id)
sendScreenshotSlotToBack(id)

// Text
addText(canvasId?)
updateText(id, patch)
deleteText(id)
duplicateText(id)
bringTextToFront(id) / sendTextToBack(id)
setSelectedTextId(id | null)

// Assets (images)
addAsset(src, canvasId?)
updateAsset(id, patch)
deleteAsset(id)
duplicateAsset(id)
bringAssetToFront(id) / sendAssetToBack(id)
setSelectedAssetId(id | null)

// Annotations
setAnnotation(patch)
addAnnotationStroke(stroke)             // returns id
updateAnnotationStroke(id, points)
deleteAnnotationStroke(id)
addAnnotationShape(shape)               // returns id
updateAnnotationShape(id, patch)
deleteAnnotationShape(id)
clearAnnotations(canvasId?)

// History
undo() / redo() / reset()

// Aspect ratio
setAspect({ id, w, h })

// Presets
setActiveLayoutPresetId(id | null)      // multi-screenshot layout
setActiveSinglePresetId(id | null)      // single-screenshot tilt preset
setPresetTab("single"|"multi")

// Bulk edit / preview
setBulkEditMode(boolean)
setIsPreviewMode(boolean)
setCanvasZoom(n)                        // editor viewport zoom
```

---

## Preset system

### Single-screenshot presets (`PRESENT_PRESETS` in `present-presets.ts`)

Tilt + scale presets for the main screenshot: Default, Left Depth, Right Depth, Axis Drift, Axis Stage L/R, Axis Front.

Stored in state as `activeSinglePresetId`. Setting a preset calls `setTiltAndScale`.

### Multi-screenshot layout presets (`LAYOUT_PRESETS` in `present-presets.ts`)

Defines how multiple screenshot slots are arranged:

- **Side by Side, Depth Duo, Fan Out, Scatter** — 2-slot compositions
- **Perspective, Drift, Step, Stacked** — 2-slot with 3D effects

Each preset has:
- `canvasTilt` + `canvasScale` — applied to the entire canvas
- `slots[]` — `{ xPct, yPct, rotation, tilt, scale }` per slot
- `portraitDevice` — alternate geometry for portrait phone frames
- `relativeSlotPositions` — when true, slot xPct/yPct are offsets from the natural row-layout position
- `mainOffset` — offset for the main (primary) screenshot

`resolveLayoutPresetGeometry(preset, frame)` picks the right geometry variant based on the device frame.

### Background presets (`lib/editor/presets.ts`)

- Gradient library: warm / cool / vivid / mono / pastel categories
- Solid colors: curated palette
- Image backgrounds: loaded from `backgrounds-data.json`
- Overlays: 100 overlay textures (id → thumbnail)

---

## Export system (`lib/editor/export.ts`)

```ts
// Export to file (PNG/JPEG/WebP)
exportCanvas(canvasId, format, resolution)
// format: "png"|"jpeg"|"webp"
// resolution: "hd" (1920px) | "4k" (3840px) | "8k" (7680px)

// Copy to clipboard at 1080px
copyCanvasAsPng(canvasId)

// Capture for sharing — PNG if ≤4MB, JPEG fallback with quality stepping
captureCanvasForShare(canvasId)
// returns { blob: Blob, contentType: "image/png"|"image/jpeg" }

// Internal
captureCanvasAsPngBlob(canvasId, targetWidth?)
```

Export finds the canvas DOM node via `[data-canvas-id="{id}"]`, injects an override `<style>` to hide UI chrome, proxies external image URLs through `/api/export/image`, then calls `html-to-image`.

The share capture caps payload at 4 MB to stay under serverless limits; if PNG exceeds that it re-encodes as JPEG stepping through qualities 0.92 → 0.85 → 0.75 → 0.65.

---

## Share system

**Flow:**
1. `captureCanvasForShare(canvasId)` → `{ blob, contentType }`
2. `POST /api/share` with blob as body, `Content-Type: image/png|image/jpeg`
3. Server authenticates (session required), checks size (≤20 MB), SHA-256 deduplicates per user
4. Uploads to R2 at `shares/{uuid}.png` with correct Content-Type
5. Writes `ShareRecord` to MongoDB
6. Returns `{ id, url, imageUrl, views, reused }`
7. Public view at `/share/{id}` fetches metadata from DB, serves image from R2 CDN

**Environment variables required for share:**
```
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET
NEXT_PUBLIC_R2_PUBLIC_BASE
```

---

## Authentication

Uses `better-auth`. Providers: email/password + Google OAuth.

```ts
// Server
import { auth } from "@/lib/auth"
const session = await auth.api.getSession({ headers: request.headers })

// Client
import { useSession, signIn, signOut } from "@/lib/auth-client"
const { data: session, isPending } = useSession()
```

Auth routes handled at `/api/auth/[...all]`.

---

## Zod usage (`lib/editor/value-schemas.ts`)

All numeric editor inputs are validated with `zod/v4`:

```ts
import { clampNumber, parseEditorNumber, editorValueSchemas } from "@/lib/editor/value-schemas"

// Clamp a number to valid range and return null if invalid
const safe = clampNumber(rawValue, 0, 100)

// Parse unknown input to number (e.g. from a text field)
const n = parseEditorNumber(inputString, 0, 240)

// Access a specific schema
editorValueSchemas.padding.parse(value)
editorValueSchemas.scale.parse(value)
```

Always use these before dispatching store actions from UI inputs.

---

## CSS utilities (`lib/editor/css-utils.ts`)

Key functions called by canvas renderer:

```ts
shadowCss(shadow, tilt)          // returns full shadow CSS (box-shadow or filter)
backgroundCss(background)        // returns CSS background string
patternCssFor(pattern)           // returns SVG pattern CSS
assetFilterCss(filter)           // returns CSS filter string for AssetFilter
effectsFilterCss(effects)        // returns CSS filter string for BackdropEffects
enhanceFilterCss(enhance)        // returns CSS filter for enhance preset
```

---

## Component conventions

- All editor components use `useEditorStore(selector)` directly or `useActiveCanvasField(selector)` for canvas-scoped reads.
- Mutations go through store actions — never mutate state directly.
- `CanvasScope` context provider scopes `canvasId` for nested components so actions default to the right canvas.
- `data-canvas-id="{id}"` attribute on the root canvas DOM node — required for export to find the element.
- `data-export-hidden="true"` on any element that should not appear in exports (UI overlays, selection borders).
- `data-selection-border="true"` on selection rings — stripped via CSS during export.

---

## Common patterns

**Reading active canvas field:**
```ts
const shadow = useEditorStore(s =>
  s.present.canvases.find(c => c.id === s.present.activeCanvasId)?.shadow
)
```

**Dispatching an action:**
```ts
const setShadow = useEditorStore(s => s.setShadow)
setShadow({ type: "drop", intensity: 60 })
```

**Checking canvas count limit:**
```ts
import { MAX_CANVASES } from "@/lib/editor/store"
// MAX_CANVASES = 20
```

**Export resolution widths:**
```ts
import { EXPORT_RESOLUTION_WIDTHS } from "@/lib/editor/export"
// { hd: 1920, "4k": 3840, "8k": 7680 }
```
