# agents.md — AI Agent Guide for Tokokino

Reference this alongside CLAUDE.md. CLAUDE.md covers architecture; this file covers task patterns, where things live, and how to make changes safely.

---

## App in one paragraph

Tokokino is a client-heavy Next.js 15.5 app deployed to Cloudflare Workers through OpenNext Cloudflare. Almost all editor logic runs in the browser via a Zustand store. The server exists only for auth (`/api/auth`), share/draft/preset metadata in Cloudflare D1, image and draft storage in Cloudflare R2, an image CORS proxy (`/api/export/image`), Unsplash integration, and Cloudflare Browser Rendering screenshots. The canvas, styling, export, and annotation tools are pure client-side React with no server round-trips.

---

## File map — where to find things

| Task | File(s) |
|---|---|
| Add/change a canvas property (shadow, border, etc.) | `lib/editor/state-types.ts` (type) + `lib/editor/store.tsx` (action) + relevant inspector component |
| Make a canvas property **animatable** (Animate mode) | See [Animate mode](#animate-mode--making-an-effect-animatable) — touches `state-types.ts`, `animation-playback.ts`, `store.tsx`, `animation-layer.tsx`, `canvas-view.tsx`/`canvas-backdrop.tsx`, `timeline-clip.tsx` |
| Add a new store action | `lib/editor/store.tsx` — add to `EditorActions` type and implement in `createEditorStore` |
| Change export behavior | `lib/editor/export.ts` |
| Add a new background type | `lib/editor/state-types.ts` (`BgType`) + `lib/editor/css-utils.ts` (`backgroundCss`) + `components/inspector/background-section.tsx` |
| Add a new shadow type | `state-types.ts` (`ShadowType`) + `css-utils.ts` (`shadowCss`) + `inspector/shadow-section.tsx` |
| Add a new device frame | `lib/mockups/index.ts` + add/update assets in the R2-backed device mockup paths |
| Add a layout preset (multi-screenshot) | `lib/editor/present-presets.ts` → `LAYOUT_PRESETS` array |
| Add a single-screenshot tilt preset | `lib/editor/present-presets.ts` → `PRESENT_PRESETS` array |
| Add a new overlay texture | Drop PNG in the overlays directory, run `pnpm build:thumbs` |
| Add a Google Font | `lib/editor/fonts.ts` → add to the fonts array |
| Add an API route | `/app/api/<name>/route.ts` |
| Change auth providers | `lib/auth.ts` |
| Change share storage behavior | `lib/share-storage.ts` for R2 objects + `lib/share-db.ts` for D1 metadata |
| Change D1 schema | `lib/db/schema.ts` + migration in `migrations/` + relevant `*-db.ts` module |
| Change environment variables | `lib/env.ts`; change Cloudflare bindings in `wrangler.jsonc` and then run `pnpm cf-typegen` |
| Change top-bar UI | `components/editor/top-bar.tsx` |
| Change right inspector panel | `components/editor/inspector/` |
| Change canvas rendering | `components/editor/canvas/` |
| Change annotation tools | `components/editor/annotation-toolbar.tsx` + `annotation-shape/` |

---

## Runtime and deploy notes

- Framework/runtime versions are pinned in `package.json`: Next.js `15.5.18`, React `19.2.x`, TypeScript `5.9.x`, `@opennextjs/cloudflare` `1.19.x`, and Wrangler `4.93.x`.
- `pnpm dev` runs `next dev --turbopack`; `next.config.mjs` initializes OpenNext Cloudflare dev bindings.
- `pnpm build` runs `opennextjs-cloudflare build`; OpenNext then calls `pnpm run build:next` from `open-next.config.ts`.
- `pnpm preview` and `pnpm deploy` both build through OpenNext first. Do not swap these to plain `next build` unless you are only debugging framework output.
- Cloudflare Worker config lives in `wrangler.jsonc`: `.open-next/worker.js`, `.open-next/assets`, `nodejs_compat`, observability, and the `TOKOKINO_DB` D1 binding.
- Prefer `pnpm typecheck` for correctness checks unless the user explicitly allows build/test/browser work.

---

## Zustand store patterns

### Reading state

```ts
// In a component — always use a selector, never subscribe to the whole store
const shadow = useEditorStore(s =>
  s.present.canvases.find(c => c.id === s.present.activeCanvasId)?.shadow
)

// Multiple values with shallow equality
import { useShallow } from "zustand/react/shallow"
const { padding, borderRadius } = useEditorStore(
  useShallow(s => {
    const c = s.present.canvases.find(c => c.id === s.present.activeCanvasId)
    return { padding: c?.padding, borderRadius: c?.borderRadius }
  })
)
```

### Dispatching actions

```ts
const setShadow = useEditorStore(s => s.setShadow)
setShadow({ type: "drop", intensity: 60, color: "#000000", lightSource: "top" })
```

### Writing a new store action

1. Add to `EditorActions` type in `store.tsx`
2. Implement in the `create(...)` block — always call `set()` with temporal middleware:
   ```ts
   myAction: (value) => {
     set((state) => {
       const canvas = getActiveCanvas(state)
       if (!canvas) return state
       return produce(state, draft => {
         draft.present.canvases.find(c => c.id === draft.present.activeCanvasId).myProp = value
       })
     })
   }
   ```
3. History grouping: rapid sequential calls within 600 ms are merged into one undo step automatically by the temporal middleware.

### History

- `undo()` / `redo()` — keyboard: `Cmd+Z` / `Cmd+Shift+Z`
- Max 100 history states
- `reset()` clears everything to defaults
- Writes to IndexedDB with 250 ms debounce — no explicit save needed

---

## Canvas rendering

The canvas DOM node must have `data-canvas-id="{canvasId}"`. Export finds it with:
```ts
document.querySelector(`[data-canvas-id="${canvasId}"]`)
```

Mark UI chrome that shouldn't appear in exports:
```tsx
<div data-export-hidden="true">...</div>
```

Mark selection borders so they are stripped:
```tsx
<div data-selection-border="true">...</div>
```

The 3D tilt effect is pure CSS `transform: rotateX() rotateY() rotateZ()` with `perspective`. The `Tilt` type is `{ rx, ry, rz }` in degrees (range −180 to 180).

Screenshot slots are positioned with `left: {xPct}%` / `top: {yPct}%` inside the canvas container.

---

## Multi-screenshot layout presets

The active preset is stored in `activeLayoutPresetId`. When a user picks a preset:

1. `setActiveLayoutPresetId(id)` is called
2. When slots are added/updated, `setScreenshotSlotImage` calls `resolveLayoutPresetGeometry(preset, frame)` to get the geometry
3. `resolveLayoutPresetGeometry` returns different geometry for portrait-device frames vs. browser/desktop frames
4. `relativeSlotPositions: true` means slot `xPct`/`yPct` are offsets from the natural row-layout position (computed by `computeRowLayout` in `screenshot-layout.ts`)

To add a new layout preset, append an object to `LAYOUT_PRESETS` in `present-presets.ts`. Required fields:
```ts
{
  id: string               // unique kebab-case id
  name: string             // display name
  canvasTilt: Tilt
  canvasScale: number
  slots: SlotLayoutConfig[]  // one entry per extra slot (max 2 for a 3-screenshot layout)
  portraitDevice?: LayoutPresetGeometry  // optional portrait phone override
}
```

---

## Export pipeline

1. `captureCanvasAsPngBlob(canvasId, targetWidth)` — renders canvas element to PNG via `html-to-image`
2. For external images in the canvas, `rewriteExportAssets` rewrites src attributes to `/api/export/image?url=...` to avoid CORS
3. An override `<style>` is injected to hide UI chrome and remove focus rings
4. Assets are preloaded before capture
5. For sharing: `captureCanvasForShare` wraps step 1, then if the PNG exceeds 4 MB it re-encodes as JPEG

**Share upload:**
- `POST /api/share` with body = the blob
- Accepts `image/png` or `image/jpeg`
- Server deduplicates by SHA-256 hash per user (same image → reuses existing share URL)
- Stores in R2 at `shares/{uuid}.png` with the real Content-Type header

---

## Zod validation

Import from `zod/v4` (not `zod`):
```ts
import { z } from "zod/v4"
```

For editor numeric inputs use the pre-built helpers:
```ts
import { clampNumber, parseEditorNumber } from "@/lib/editor/value-schemas"

const safe = clampNumber(rawValue, 0, 100)   // returns null if NaN/Infinity
const n    = parseEditorNumber(inputStr, 0, 240) // parses string → number, clamps
```

All slider/input ranges are defined in `editorValueSchemas`. Match new inputs to existing ranges or add a new entry to the schema map.

---

## Adding a new canvas property

Checklist:
1. **Type** — add to `CanvasState` in `state-types.ts`
2. **Default** — add to `DEFAULT_CANVAS_STATE` in `store.tsx`
3. **Action** — add setter to `EditorActions` type and implement in `store.tsx`
4. **CSS** — if the property affects rendering, add CSS generation in `css-utils.ts`
5. **UI** — add control in the relevant inspector section under `components/editor/inspector/`
6. **Validation** — add Zod range to `value-schemas.ts` if it's a numeric input

---

## Animate mode — making an effect animatable

Animate mode is a per-canvas timeline of **clips** (keyframes). Each clip OWNS a set
of effects (`clip.effects: AnimationEffect[]`) — the properties that were changed
while it was the selected clip. Playback samples each owned effect independently and
drives the live canvas through CSS variables (no store re-render per frame).

Core files:
- `lib/editor/animation-playback.ts` — interpolation helpers, stack resolvers, the `AnimationEffect`/`ClipBaseline` plumbing, `DEFAULT_BASELINE`.
- `components/editor/animate/animation-layer.tsx` — the per-frame player: samples every owned effect at the playhead and writes CSS vars; clears them at rest.
- `components/editor/canvas/canvas-view.tsx` + `canvas-backdrop.tsx` — read those vars via `var(--…, <committed fallback>)`.
- `components/editor/animate/timeline-clip.tsx` — the icon shown on a clip per owned effect.
- `lib/editor/store.tsx` — `commitCanvasEffect`, the pose helpers (`captureClipPose` / `applyPoseToCanvas` / `resolveKeyframePose`).

### The non-negotiable rules (every animatable effect MUST follow these)

1. **Start from the canvas's committed value, never 0/neutral.** The value an effect
   eases FROM is the *first owning clip's baseline* (`clip.baseline`, captured when the
   clip was created = the committed canvas pose before that clip's edits). Use the
   `restFor(effect, extract, fallback)` helper in `animation-layer.tsx` for this — the
   `fallback` is only used when no clip owns the effect (so it's never actually sampled).
   A tilt that sits at −12° must animate from −12°, not from 0.
2. **Continuous between keyframes — cross-blend, don't snap.** Back-to-back keyframes
   must ease the previous rendered value → the next. Two DIFFERENT looks (e.g. a drop
   shadow → a soft shadow, or a colour change) cross-blend; the old one eases OUT as the
   new eases IN. Never let one value hard-cut to the next.
3. **Reveal-from-nothing is a fade, not a jump.** When the committed base has the effect
   OFF (no shadow, no border, zero-intensity lighting), the first keyframe grows/fades it
   in from invisible — but that "invisible" is the base's own position/colour so nothing
   travels or hue-slides on the way in. (See `lightingEntranceRest`, `INVISIBLE_BORDER`,
   `INVISIBLE_SHADOW`.)
4. **Hold at the end — no trailing jitter.** Past a clip's window an effect holds its
   final value (`clipsProgressAt` clamps to 1). The last keyframe must not spring, fall,
   or re-animate after settling.
5. **A colour/style-only change is still a valid keyframe.** An effect can animate a
   pure recolour or style swap with no size change; interpolate colour as RGBA (fade
   alpha for emergence) and snap categorical fields (border style, shadow/lighting
   target) at the midpoint since CSS can't render two at once.

### Two interpolation shapes — pick the right one

- **Numeric / interpolatable track** (tilt, zoom, padding, canvasRadius, shadow, border,
  backdrop effects, lighting): sample with `sampleKeyframes<V>(framesFor(...), playhead,
  restFor(...), lerpValue)`. Provide a `lerpValue(from, to, p)` (e.g. `borderBetween`,
  `shadowBetween`, `lightingBetween`). Drive the result onto a CSS var each frame; the
  renderer reads `var(--…, <committed>)`.
- **Layered overlay stacks** (background, filter, portrait, pattern, overlay): each
  keyframe owns its own layer; the player drives per-layer opacity vars.
  - **Opaque layers** (background, filter — later fully covers earlier): opacity = plain
    `clipsProgressAt([clip])`.
  - **Additive/transparent layers** (portrait vignette, pattern, overlay texture): use
    the **crossfade-chain** so they transition instead of accumulating:
    `layer_i = progress(i)·(1 − progress(i+1))`, base = `1 − progress(0)`, last layer
    holds. At rest only the selected keyframe's layer shows (`restOpaque: i === restCutoff`).
  Stack resolvers live in `animation-playback.ts` as `resolveAnimateXStack` returning
  `{ base, layers[] }`; render one node per layer in `canvas-backdrop.tsx` (and, for
  effects with an over/under position like overlay, also in `canvas-view.tsx`).

### Checklist to add a new animatable effect

1. **`state-types.ts`** — add the key to the `AnimationEffect` union and an optional
   `myEffect?: T` field to `ClipBaseline` (optional so older drafts hydrate cleanly).
2. **`animation-playback.ts`** — add `myEffect: DEFAULT_CANVAS_BASE.myEffect` to
   `DEFAULT_BASELINE`; add the interpolator (`myEffectBetween`, or a `resolveAnimateXStack`
   for a layered stack) and an `INVISIBLE_/EMPTY_` rest constant.
3. **`store.tsx`** — capture it in `captureClipPose`, apply it in `applyPoseToCanvas`
   (with `?? canvas.myEffect` fallback), resolve it in `resolveKeyframePose`, and change
   its setter from `commitCanvas` to `commitCanvasEffect(id, patch, group, "myEffect")` so
   editing it while a clip is selected registers ownership.
4. **`animation-layer.tsx`** — sample/drive the CSS var(s) in the player loop, and add
   them to `SCOPE_VARS`/`CANVAS_FX_VARS` (or the per-clip clear loop) so `clearAll` resets
   them at rest.
5. **`canvas-view.tsx` / `canvas-backdrop.tsx`** — read the var via
   `var(--…, <committed fallback>)`. If a clip owns the effect, mount the element even when
   the committed value is neutral (an `xxxAnimated` flag), so it can ease in from nothing.
6. **`timeline-clip.tsx`** — add the effect to the `ICON_FOR` map (shares the inspector
   section's icon).
7. Verify with `pnpm typecheck` + `npx eslint <changed files>` (the exhaustive
   `Record<AnimationEffect, …>` in `timeline-clip.tsx` will fail typecheck until step 6).

### Gotchas

- **`commitCanvasEffect`, not `commitCanvas`** — plain `commitCanvas` won't register the
  clip as owning the effect, so it silently won't animate.
- **Stale IDE diagnostics** — after extending the `AnimationEffect` union the TS language
  server may still flag `"myEffect" does not exist`; `pnpm typecheck` is authoritative.
- **Main vs slots** — only effects in `SLOT_ANIMATABLE_EFFECTS` (tilt/zoom/shadow) animate
  on extra screenshot slots; canvas-wide effects are main-only (driven on `mainScopeEl`).
- **"Remove effects"** on a clip must revert its pose to baseline AND clear
  `clip.effects` — see `clearAnimationClipEffects` in `store.tsx`.

---

## Adding a new API route

Create `/app/api/<name>/route.ts`. For protected routes:
```ts
import { auth } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // ...
}
```

For large body uploads, set:
```ts
export const runtime = "nodejs"
```

---

## Environment variables

Validated in `lib/env.ts`. Server-only vars throw at import time if missing. Client vars use `NEXT_PUBLIC_` prefix.

Required for share feature:
```
R2_BUCKET
R2_S3_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Required for auth:
```
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID      (optional, for Google OAuth)
GOOGLE_CLIENT_SECRET  (optional)
```

Required for Cloudflare Browser Rendering screenshots:
```
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_BROWSER_API_TOKEN
```

---

## Database (Cloudflare D1)

Access D1 through `lib/d1.ts`, which reads the `TOKOKINO_DB` binding from OpenNext Cloudflare context and returns a Drizzle client. Schema lives in `lib/db/schema.ts`; migrations live in `migrations/`.

Tables:
- `shares` — share metadata, content hashes, R2 object keys, and view counters
- `share_views` — per-IP-hash view tracking for public shares
- `drafts` — saved draft metadata; full draft JSON and thumbnails live in R2
- `custom_presets` — user-created layout/style preset metadata

better-auth stores its auth tables in D1 through `lib/auth.ts`.

---

## Shadcn components

Located in `components/ui/`. Use them directly:
```ts
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
```

Do not modify shadcn base components — wrap them instead.

---

## Icons

Two icon libraries are used:
- `@remixicon/react` — primary (most editor icons)
- `lucide-react` — secondary

Pick from Remixicon first. Always use the `className="size-4"` pattern (not `width`/`height` props).

---

## Toast notifications

```ts
import { toast } from "sonner"

toast.success("Exported!")
toast.error("Export failed. Please try again.")
toast("Feature in development")
```

---

## Animations

Use `motion` from `motion/react` (not `framer-motion`):
```ts
import { motion, AnimatePresence } from "motion/react"
```

The store uses `motion` for preview slide/fade/zoom/flip transitions between canvases.

---

## Common gotchas

- **Zod import**: always `from "zod/v4"`, not `from "zod"` — this project uses the v4 subpath export.
- **Canvas not found in export**: make sure the canvas root element has `data-canvas-id={id}` attribute.
- **History pollution**: setting multiple store values in sequence creates multiple undo steps. Use combined actions like `setTiltAndScale` or `setScreenshotPlacement` when the UI groups changes together.
- **Bulk edit mode**: when `bulkEditMode` is true, the layout changes — don't assume a single active canvas. Guard with `s.present.bulkEditMode` checks where needed.
- **Max canvases**: `MAX_CANVASES = 20`. Check before calling `addCanvas()`.
- **Max screenshot slots**: 3 per canvas. The store enforces this internally.
- **Share content-type**: server accepts both `image/png` and `image/jpeg`. Always forward the content-type from `captureCanvasForShare`.
- **External image CORS**: any background or asset image from an external domain must be proxied through `/api/export/image` for export to work. The `rewriteExportAssets` function handles this automatically during capture.
- **Tailwind v4**: uses the CSS-first config approach, not `tailwind.config.ts`. Theme tokens are in `globals.css`.
