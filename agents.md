# agents.md — AI Agent Guide for Tokokino

Reference this alongside CLAUDE.md. CLAUDE.md covers architecture; this file covers task patterns, where things live, and how to make changes safely.

---

## App in one paragraph

Tokokino is a client-heavy Next.js app. Almost all logic runs in the browser via a Zustand store. The server exists only for: auth (`/api/auth`), share upload to Cloudflare R2 (`/api/share`), an image CORS proxy (`/api/export/image`), and Unsplash integration. The canvas, styling, export, and annotation tools are all pure client-side React with no server round-trips.

---

## File map — where to find things

| Task | File(s) |
|---|---|
| Add/change a canvas property (shadow, border, etc.) | `lib/editor/state-types.ts` (type) + `lib/editor/store.tsx` (action) + relevant inspector component |
| Add a new store action | `lib/editor/store.tsx` — add to `EditorActions` type and implement in `createEditorStore` |
| Change export behavior | `lib/editor/export.ts` |
| Add a new background type | `lib/editor/state-types.ts` (`BgType`) + `lib/editor/css-utils.ts` (`backgroundCss`) + `components/inspector/background-section.tsx` |
| Add a new shadow type | `state-types.ts` (`ShadowType`) + `css-utils.ts` (`shadowCss`) + `inspector/shadow-section.tsx` |
| Add a new device frame | `lib/mockups/index.ts` + run `pnpm build:device-mockup-thumbs` |
| Add a layout preset (multi-screenshot) | `lib/editor/present-presets.ts` → `LAYOUT_PRESETS` array |
| Add a single-screenshot tilt preset | `lib/editor/present-presets.ts` → `PRESENT_PRESETS` array |
| Add a new overlay texture | Drop PNG in the overlays directory, run `pnpm build:thumbs` |
| Add a Google Font | `lib/editor/fonts.ts` → add to the fonts array |
| Add an API route | `/app/api/<name>/route.ts` |
| Change auth providers | `lib/auth.ts` |
| Change share storage behavior | `lib/share-storage.ts` |
| Change MongoDB schema | `lib/share-db.ts` |
| Change environment variables | `lib/env.ts` |
| Change top-bar UI | `components/editor/top-bar.tsx` |
| Change right inspector panel | `components/editor/inspector/` |
| Change canvas rendering | `components/editor/canvas/` |
| Change annotation tools | `components/editor/annotation-toolbar.tsx` + `annotation-shape/` |

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
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET
NEXT_PUBLIC_R2_PUBLIC_BASE
MONGODB_URI
```

Required for auth:
```
BETTER_AUTH_SECRET
GOOGLE_CLIENT_ID      (optional, for Google OAuth)
GOOGLE_CLIENT_SECRET  (optional)
```

---

## Database (MongoDB)

Access via `lib/share-db.ts`. The MongoDB client is a singleton in `lib/mongo.ts`.

Collections:
- `shares` — `ShareRecord` documents (share metadata, view counts)
- `shareViews` — `ShareViewRecord` documents (per-IP view tracking)

better-auth manages its own collections (`user`, `session`, `account`, `verification`).

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
