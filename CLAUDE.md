# CLAUDE.md — Tokokino 

## Project overview

**Tokokino** is a browser-based screenshot and video composer. Users drop in a screenshot, video, or GIF, style it with backgrounds, shadows, device frames, 3D shapes, text layers, and annotations, optionally animate it on a per-canvas timeline, then export a still (PNG/JPEG/WebP), a video (WebM/MP4/GIF), or share a public link. Editing, animation playback, and *all* encoding happen client-side; the server handles auth, share/draft/media uploads to Cloudflare R2, and metadata in Cloudflare D1 via OpenNext Cloudflare.

The editor is one route (`/app`) — everything else (`/`, `/showcase`, `/compare`, `/glossary`, `/changelog`) is the marketing site.

**Stack:**
- Next.js 16.2.12 (App Router) + React 19.2, Turbopack in dev
- OpenNext Cloudflare (`@opennextjs/cloudflare` 1.20) + Wrangler 4 for Cloudflare Workers deployment
- Zustand 5 for all editor state, with undo/redo and IndexedDB persistence
- Tailwind CSS v4 + shadcn components + Radix UI primitives
- better-auth (email + Google OAuth), Cloudflare D1 via Drizzle, Cloudflare R2 via AWS S3 SDK
- `html-to-image` for canvas capture, `motion` for animation, `@dnd-kit` for drag-and-drop, `@xyflow/react` for the bulk-edit canvas
- Mediabunny + WebCodecs for on-device video export, with a bundled dav1d AV1 WebAssembly fallback for Safari/WebKit; `gifenc` for GIF
- Cloudflare Browser Rendering (`@cloudflare/puppeteer`) for URL capture
- PostHog for analytics and error capture
- Zod v4 (`zod/v4`) for input validation
- TypeScript strict mode

---

## Dev commands

```bash
pnpm dev          # starts Next.js with Turbopack
pnpm build        # OpenNext Cloudflare production build
pnpm build:next   # raw next build used by OpenNext
pnpm preview      # OpenNext Cloudflare build + local preview
pnpm deploy       # OpenNext Cloudflare build + deploy
pnpm typecheck    # tsc --noEmit (run before committing)
pnpm test         # vitest run tests
pnpm lint:fix     # ESLint auto-fix
pnpm lint:strict  # ESLint with --max-warnings=0
pnpm format       # oxfmt on all .ts/.tsx
```

Asset build scripts (run once after adding overlays/backgrounds/shapes):
```bash
pnpm build:thumbs                 # overlay thumbnails
pnpm build:backgrounds            # background thumbnails
pnpm build:shapes                 # 3D shape manifest + thumbnails
```

---

## Directory structure

```
/app                      Next.js App Router pages, API routes, and metadata routes
  /app/page.tsx           Marketing landing page
  /app/app/page.tsx       The editor — client-only dynamic import of EditorApp
  /app/app/shares/page.tsx  User's share history
  /app/layout.tsx         App shell (providers)
  /api/share/*            Create share links; multipart uploads for video shares
  /api/drafts/*           Draft metadata, thumbnails, and draft media (video) blobs
  /api/presets/*          Custom preset CRUD
  /api/preferences        Per-user editor preferences
  /api/account            Account management + deletion
  /api/auth/[...all]      better-auth handler
  /api/export/image       CORS proxy for external images
  /api/screenshot         Cloudflare Browser Rendering URL capture
  /api/tweet              Tweet/Bluesky post fetch for mockups
  /api/templates/thumb    Template thumbnail proxy
  /api/unsplash/*         Unsplash search + download
  /api/feedback           Feedback submissions
  /login/                 Auth pages
  /share/[id]/            Public share view
  /showcase/, /compare/, /glossary/, /changelog/   Marketing + SEO pages
  /terms/, /privacy/, /dpa/                        Legal pages
  sitemap.ts               Generated sitemap.xml
  robots.ts                Generated robots.txt
  /llms.txt/route.ts       AI crawler summary endpoint
  /auth.md/route.ts        Auth docs for MCP/agent clients

/components/editor/       All editor UI
  editor-app.tsx          Editor root
  canvas/                 Canvas renderer (canvas-view, canvas-backdrop, …)
  inspector/              Right-hand styling panel (one file per section)
  animate/                Animate mode: timeline, clips, easing, player
  templates/              Template picker dialog
  toolbar/, top-bar/, mobile-controls/, settings/
/components/ui/           shadcn component library
/lib/editor/              Core editor logic
  store.tsx               Zustand store — all state & actions
  store/                  Defaults, canvas helpers, layer stack, draft persistence
  state-types.ts          All TypeScript types
  export.ts               Still image capture & export
  animation-export/       Video/GIF encode pipeline (Mediabunny + WebCodecs)
  animation-playback.ts   Clip sampling, interpolation, effect stacks
  animation-timeline.ts   Timeline math
  apply-animation-frame.ts  Applies a sampled frame during export
  clip-easing.ts          Easing kinds + custom cubic-bezier helpers
  templates/              Template catalogue and apply logic
  css-utils.ts            CSS generation (shadows, filters, backgrounds)
  color-utils.ts          Color sampling & gradient generation
  fonts.ts                Google Fonts catalogue (100+ fonts)
  presets.ts              Gradient/solid/overlay presets
  present-presets.ts      Multi-screenshot layout presets + single tilt presets
  shapes-data.json        3D shape manifest (106 shapes on the asset CDN)
  backgrounds-data.json   Background image manifest
  screenshot-layout.ts    Row layout algorithm for multi-screenshot
  media-type.ts           Video/image detection + object-URL registry
  gif-to-video.ts         Re-encodes imported GIFs to WebM
  video-registry.ts       Bridges the <video> element to the control bar
  video-timeline-map.ts   Maps video clips onto the animation timeline
  capture-url.ts, full-page-capture.ts  URL capture flows
  value-schemas.ts        Zod schemas for all numeric inputs
  types.ts                Misc types
/lib/
  auth.ts                 better-auth server instance
  auth-client.ts          Client-side auth hooks
  env.ts                  Environment variable validation
  d1.ts                   Cloudflare D1 + Drizzle entrypoint via OpenNext context
  db/schema.ts            Drizzle schema for all D1 tables
  share.ts                Share URL helpers, UUID validation
  share-db.ts             D1 share CRUD + view tracking
  share-upload-*.ts       Multipart share uploads (large video shares)
  draft-db.ts             D1 draft metadata CRUD
  draft-media-db.ts       D1 draft media (video) records
  preset-db.ts            D1 custom preset CRUD
  user-preferences-db.ts  D1 per-user preferences
  share-storage.ts        R2 share image upload/download
  draft-storage.ts        R2 draft state + thumbnail storage
  template-storage.ts     R2 template assets
  r2-client.ts            R2 S3-compatible client
  account-deletion.ts     Async account deletion via Cloudflare Queue
  offline/offline-shell.ts  Offline editing shell
  mockups/index.ts        Device frame catalogue
  compare/comparisons.ts  /compare page data
  browser-frame.ts        Browser frame constants (Safari/Chrome/Arc)
/hooks/                   Shared React hooks (toolbar rects, media queries, …)
/tests/                   Vitest suites (`pnpm test`)
/wiki/core/               Long-form feature docs — see wiki/core/README.md
```

---

## Editor state — Zustand store (`lib/editor/store.tsx`)

The entire editor state lives in one Zustand store with temporal middleware for undo/redo.

### Top-level state shape

Only the six fields inside `present` are undoable. Everything else listed below lives on the store root (UI/session state) and is **not** part of `EditorState` — `s.bulkEditMode`, not `s.present.bulkEditMode`.

```ts
{
  // Undoable document state (EditorState)
  past: EditorState[]     // max 100 (HISTORY_LIMIT)
  present: {
    activeTool: EditorTool          // "pointer"|"crop"|"text"|"arrow"|"position"|"layers"|"enhance"
    aspect: AspectState             // { id, w, h } — canvas aspect ratio
    canvasZoom: number              // editor viewport zoom (not the screenshot scale)
    annotation: Annotation          // current annotation tool state
    canvases: CanvasState[]
    activeCanvasId: string
  }
  future: EditorState[]

  // Modes
  isAnimateMode: boolean
  isPreviewMode: boolean
  isPreviewAutoScroll: boolean
  previewAutoScrollDelay: number
  previewAnimation: "slide"|"fade"|"zoom"|"flip"
  bulkEditMode: boolean
  bulkCanvasDragging: boolean
  bulkViewportZoom: number
  bulkScale: number

  // Selection
  selectedTextId / selectedAssetId / selectedAnnotationShapeId /
  selectedScreenshotSlotId: string | null
  isScreenshotSelected: boolean
  selectedAnimationClipId: string | null    // clip open for editing
  selectedAnimationClipIds: string[]        // marquee/bulk timeline selection

  // Layout preset tracking
  presetTab: "single"|"multi"
  activeLayoutPresetId: string | null   // multi-screenshot preset
  activeSinglePresetId: string | null   // single-screenshot tilt preset
  activeCustomPresetId: string | null

  // Custom presets (server-backed) + current draft
  customPresets: CustomPresetSummary[]
  customPresetsLoaded / Loading / Error: boolean
  customPresetsSort / customPresetsListSort: PresetSort
  currentDraft: CurrentDraftInfo | null
}
```

### Canvas state (`CanvasState`) — the "screenshot box"

Each canvas is one styled screenshot card:

```ts
{
  id: string
  position: { x, y }            // position on the infinite bulk-edit canvas

  // Screenshot / image / video
  screenshot: string | null      // current media src (image or video; may be cropped)
  originalScreenshot: string | null  // pre-crop backup
  lastCropRegion: CropRegion | null
  fullPageCapture?: FullPageCapture | null   // { scrollPosition } for URL captures
  videoClips?: VideoTimelineClip[] | null    // trim/mute segments when the media is video

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

  // Social post mockup (X / Bluesky card rendered instead of a screenshot)
  tweet: TweetCard | null

  // Per-canvas aspect override and Animate-mode timeline
  aspect?: AspectState
  animation?: CanvasAnimation      // { durationMs, clips: AnimationClip[] }
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

// Animate mode (per-canvas timeline)
setIsAnimateMode(boolean)
setAnimationDuration(ms, canvasId?)
addAnimationClip(canvasId?, atMs?)        // returns clip id
updateAnimationClip(id, patch, canvasId?)
moveAnimationClip(id, startMs, canvasId?)
splitAnimationClip(id, atMs, canvasId?)
duplicateAnimationClip(id, canvasId?)
removeAnimationClip(id, canvasId?)
clearAnimationClipEffects(id, canvasId?)
clearAnimationClips(canvasId?)
selectAnimationClip(id | null, canvasId?)
setAnimationClipSelection(ids, canvasId?)  // marquee / bulk select
removeAnimationClips(ids) / duplicateAnimationClips(ids) / clearAnimationClipsEffects(ids)

// Video media
updateVideoClip(id, patch, canvasId?)     // trim / mute a video segment

// Social post mockups
setTweet(card, canvasId?)

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
- Image backgrounds: loaded from `backgrounds-data.json` (mesh, lines, gradient, raycast, mac, cloud, wood, fluid, minimal packs)
- Overlays: 100 overlay textures (id → thumbnail)

### Templates (`lib/editor/templates/`)

20 ready-made compositions (`TEMPLATE_CATALOG` in `catalog.ts`), several of them animated. `apply.ts` writes a template onto the active canvas — including its animation clips — and `capture.ts` renders template thumbnails. UI lives in `components/editor/templates/templates-dialog.tsx`.

### 3D shapes (`lib/editor/shapes-data.json`)

106 shapes hosted on the asset CDN, browsed from `components/editor/inspector/shapes-section.tsx`. Dropping one adds a normal `AssetElement`, so shapes move, scale, filter, and reorder like any other image layer. Regenerate the manifest with `pnpm build:shapes`.

---

## Animate mode (`components/editor/animate/`, `lib/editor/animation-*.ts`)

Each canvas can carry `animation: { durationMs, clips }`. A **clip** is a keyframe that owns a set of effects (`clip.effects: AnimationEffect[]`) — the properties edited while that clip was selected. Playback samples every owned effect independently and drives the live canvas through CSS variables, so no store write happens per frame.

```ts
AnimationClip = {
  id, startMs, durationMs
  target?: { scope: "all" } | { scope: "main" } | { scope: "slot"; slotId }
  effects?: AnimationEffect[]      // "position"|"zoom"|"tilt"|"padding"|"shadow"|
                                   // "background"|"backdrop"|"canvasRadius"|"lighting"|
                                   // "filter"|"portrait"|"pattern"|"overlay"|"border"|
                                   // "borderRadius"|"crop"
  pose?: ClipBaseline              // target values
  baseline?: ClipBaseline          // committed values the clip eases FROM
  easing?: ClipEasingKind          // "linear"|"cubic"|"in"|"out"|"inOut"|"outCirc"|"custom"
  easingBezier?: ClipEasingBezier  // control points when easing === "custom"
  speed?: number
  returnToDefault?: boolean        // undefined reads as ON
}
```

- Easing helpers and the custom cubic-bezier maths live in `lib/editor/clip-easing.ts`; the draggable graph is `animate/bezier-curve-editor.tsx`, wired up from `animate/clip-transition-toolbar.tsx`.
- Only `tilt`, `zoom`, `shadow`, `position`, `border`, `borderRadius`, `padding`, and `lighting` can animate on an extra screenshot slot (`SLOT_ANIMATABLE_EFFECTS` in `store.tsx`); everything else is main-canvas only.
- Adding a *new* animatable effect is a multi-file checklist — follow the Animate mode section in `agents.md`.

---

## Video on the canvas

A canvas's `screenshot` can be a video source. `lib/editor/media-type.ts` decides image vs video and keeps an object-URL → Blob registry so draft persistence can round-trip the bytes through IndexedDB (a raw `blob:` URL is dead after reload). Imported GIFs are re-encoded to WebM by `gif-to-video.ts` so they run through the same pipeline. `videoClips` holds trim/mute segments, `video-timeline-map.ts` maps them onto the Animate timeline, and `video-registry.ts` bridges the `<video>` element to the docked control bar.

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

### Animation export (`lib/editor/animation-export/`)

```ts
exportAnimation(canvasId, options)       // encodes and downloads
exportAnimationBlob(canvasId, options)   // same encode, returns the blob (share)
isWebmExportSupported()
```

Formats: `webm`, `mp4`, `gif`. The whole encode is on-device — Mediabunny + WebCodecs for video and audio muxing, `gifenc` for GIF, with a bundled dav1d AV1 WebAssembly decoder as the Safari/WebKit fallback. Frames are produced by capturing the canvas per timestep with `apply-animation-frame.ts` applying the sampled pose. `animation-audio.ts` muxes source video audio; `watermark.ts` stamps free-tier exports. GIF output is bounded by a frames × area memory cap so `gifenc` can't OOM the tab.

---

## Cloudflare / OpenNext deployment

The app is deployed as a Cloudflare Worker using OpenNext Cloudflare.

- `next.config.mjs` calls `initOpenNextCloudflareForDev()` so local dev can access Cloudflare bindings through OpenNext.
- `open-next.config.ts` uses `defineCloudflareConfig()` and delegates the framework build to `pnpm run build:next`.
- `wrangler.jsonc` points `main` at `.open-next/worker.js`, serves static assets from `.open-next/assets`, enables `nodejs_compat`, and binds D1 as `TOKOKINO_DB`.
- Use `pnpm build` for the OpenNext production build; do not use raw `next build` as the deploy artifact unless specifically debugging OpenNext.
- Use `pnpm cf-typegen` after changing Wrangler bindings so `cloudflare-env.d.ts` stays current.

---

## Share system

Shares can be stills or animations. Stills go up in one request; videos go through a multipart upload because they are far too big for a single Worker request body.

**Still flow:**
1. `captureCanvasForShare(canvasId)` → `{ blob, contentType }`
2. `POST /api/share` with blob as body, `Content-Type: image/png|image/jpeg`
3. Server authenticates (session required), enforces `MAX_SHARE_IMAGE_BYTES` (40 MB) and the per-user storage quota `MAX_USER_SHARE_STORAGE_BYTES` (1 GB), SHA-256 deduplicates per user
4. Uploads to R2 under `shares/{uuid}` with the real Content-Type
5. Writes the share row to Cloudflare D1 via Drizzle
6. Returns `{ id, url, imageUrl, views, reused }`
7. Public view at `/share/{id}` fetches metadata from DB, serves media from R2 CDN

**Video flow:** `POST /api/share/uploads` opens an R2 multipart upload (8 MB parts, 1 GB ceiling), parts go to `/api/share/uploads/{id}/parts/{partNumber}`, a poster frame to `/api/share/uploads/{id}/poster`, then `/api/share/uploads/{id}/complete` finalises it. Client helpers live in `lib/share-upload-client.ts`; `/api/share/[id]/poster` and `/api/share/[id]/download` serve the result.

**Environment variables required for share:**
```
R2_BUCKET
R2_S3_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

---

## Drafts and offline editing

Editor state is persisted to IndexedDB on a debounce (`lib/editor/store/draft-persistence.ts`) — there is no explicit save. Signed-in users also sync drafts to the server: metadata in D1 (`drafts`), full draft JSON and thumbnails in R2 (`lib/draft-storage.ts`), and video bytes as separate draft-media objects (`lib/draft-media-db.ts`, `/api/drafts/media/*`) so a reloaded draft can restore its video. `lib/offline/offline-shell.ts` keeps the editor usable with no network.

---

## Authentication

Uses `better-auth` with the Cloudflare D1 adapter/binding. Providers: email/password + Google OAuth.

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

**Slot limit:**
```ts
import { MAX_SCREENSHOT_SLOTS } from "@/lib/editor/store"
// MAX_SCREENSHOT_SLOTS = 3
```

---

## Deeper docs

`wiki/core/` holds long-form docs per feature — `animate-mode.md`, `animation-export.md`, `video-canvas.md`, `video-export.md`, `templates.md`, `canvas.md`, `editor-store.md`, `share.md`, `drafts.md`, `offline.md`, `architecture.md`, and more. Start at `wiki/core/README.md`. `agents.md` covers task recipes (where to change what, the checklist for adding an animatable effect).
