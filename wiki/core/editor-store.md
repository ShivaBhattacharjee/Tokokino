# Editor store (Zustand)

All editor state lives in one Zustand store (`lib/editor/store.tsx`) with temporal-style undo/redo and IndexedDB autosave. The store is the single source of truth for canvases, tools, Animate clips, bulk/preview UI flags, and custom-preset cache.

---

## Shape

```ts
// Conceptual top level (simplified)
{
  // UI outside undoable "present"
  past / present / future   // history of EditorState
  // plus ephemeral UI: selection, drag flags, dialogs, custom presets list, current draft, …

  present: EditorState {
    activeTool, aspect, canvasZoom, annotation,
    canvases: CanvasState[],
    activeCanvasId
  }
}
```

Full types: `lib/editor/state-types.ts`. Defaults: `lib/editor/store/defaults.ts`.

### `CanvasState` (one “card”)

Screenshot box + style + layers + optional animation:

| Group | Fields |
|---|---|
| Identity | `id`, `position` (bulk canvas) |
| Media | `screenshot`, `originalScreenshot`, `lastCropRegion`, `fullPageCapture`, `videoClips`, `objectFit`, `tweet` |
| Box style | `background`, `padding`, `borderRadius`, `canvasBorderRadius`, `border`, `backdrop` |
| Transform | `tilt`, `scale`, `screenshotPosition`, `screenshotOffset`, `screenshotLayer` |
| Effects | `shadow`, `overlay`, `frame`, `portrait`, `enhance`, `mediaAdjustments`, `mediaFilter` |
| Layers | `texts`, `assets`, `annotations`, `annotationShapes`, `screenshotSlots` |
| Misc | `frameAddress`, `aspect?`, `animation?` |

### Limits

| Constant | Value | Where |
|---|---|---|
| `MAX_CANVASES` | 20 | store |
| `MAX_SCREENSHOT_SLOTS` | 3 extra | store |
| History depth | ~100 | temporal middleware |
| Autosave debounce | 250 ms | `draft-persistence.ts` |

---

## Module layout

```text
lib/editor/
├── store.tsx              # stable public facade + action composition
├── state-types.ts         # shared types
├── value-schemas.ts       # Zod ranges for inputs
└── store/
    ├── types.ts           # EditorStore state and action contracts
    ├── initial-state.ts   # root/session initial values
    ├── commit-context.ts  # history-aware commit primitives
    ├── animation-helpers.ts
    ├── actions/           # domain factories: media, style, layers, animation, etc.
    ├── provider.tsx       # EditorProvider — hydrate, autosave, shortcuts, template URL
    ├── draft-persistence.ts
    ├── defaults.ts
    ├── canvas-helpers.ts
    ├── layer-stack.ts
    └── use-editor.tsx     # canvas-scoped hooks
```

### Action factories

| Module | Responsibility |
|---|---|
| `actions/project.ts` | Active presets, custom-preset cache, draft/template loading, preset snapshots |
| `actions/media.ts` | Main screenshot, full-page capture, crop, and video timeline sections |
| `actions/canvas-style.ts` | Aspect, background, transforms, screenshot styling, frames, effects, and post mockups |
| `actions/layers.ts` | Text, assets, annotations, selection, and layer ordering |
| `actions/animation.ts` | Animate-mode lifecycle, clip selection, clip CRUD, split, ripple, and duration |
| `actions/session.ts` | Preview, bulk-edit, popover, viewport, and drag flags outside undo history |
| `actions/canvases.ts` | Undo/redo/reset plus canvas collection and bulk-board positioning |
| `actions/slots.ts` | Extra screenshot-slot creation, media, placement, duplication, and ordering |

`store.tsx` creates the shared commit context once and composes every factory.
Components continue importing `useEditorStore` and public types from
`@/lib/editor/store`; internal modules import contracts directly from
`store/types.ts` to avoid depending on the public facade.

Dependency direction is deliberately one-way:

```text
state/contracts → pure helpers + commit context → action factories → store.tsx
```

Action factories do not import one another. Existing cross-domain coordination
uses `get()` to call the already-composed public store action when necessary.

---

## Read / write patterns

```ts
// Read — always select
const shadow = useEditorStore(s =>
  s.present.canvases.find(c => c.id === s.present.activeCanvasId)?.shadow
)

// Write — action only
const setShadow = useEditorStore(s => s.setShadow)
setShadow({ type: "drop", intensity: 60 })
```

Multi-field reads: `useShallow` from `zustand/react/shallow`.

Canvas-scoped convenience: `useActiveCanvasField` / helpers in `store/use-editor.tsx` and `CanvasScope` context.

### Adding an action

1. Add its signature to `EditorActions` in `store/types.ts`.
2. Implement it in the factory that owns the domain.
3. Use raw `set` only for non-undoable session state.
4. Use `commit` or `commitCanvas` for undoable document changes.
5. Use `commitCanvasEffect` for animatable canvas or slot effects so the selected keyframe records ownership.

The final object returned by `store.tsx` must satisfy `EditorStore`, so a missing
or incorrectly typed action fails typecheck without changing the public API.

---

## Commit paths

```mermaid
flowchart TD
  UI["Inspector / canvas gesture"] --> Action["store action"]
  Action --> Path{"Animatable effect + clip selected?"}
  Path -->|yes| CCE["commitCanvasEffect<br/>patch + register clip.effects"]
  Path -->|no| CC["commitCanvas / direct set"]
  CCE --> Hist["History entry (grouped ~600ms)"]
  CC --> Hist
  Hist --> Present["present.canvases…"]
  Present --> Autosave["debounced IndexedDB"]
  Present --> React["React re-render via selectors"]
```

| Helper | Role |
|---|---|
| `commitCanvas` | Patch active (or target) canvas; history |
| `commitCanvasEffect` | Same + mark selected clip as owning effect keys |
| Combined actions | e.g. `setTiltAndScale`, `setScreenshotPlacement` — one undo step |
| History groups | Rapid sequential writes within ~600 ms merge |

**Rule:** if a property should animate in Animate mode, its setter must go through `commitCanvasEffect` with the effect name (see [animate-mode.md](./animate-mode.md)).

---

## Pose helpers (Animate)

| Function | Role |
|---|---|
| `captureClipPose` | Snapshot canvas → `ClipBaseline` when creating/updating a clip |
| `applyPoseToCanvas` | Apply a pose onto canvas fields |
| `resolveKeyframePose` | Resolve baseline/pose for a keyframe |
| `clearAnimationClipEffects` | Revert clip to baseline + clear `effects` |

---

## History & reset

| Action | Behavior |
|---|---|
| `undo` / `redo` | Keyboard `Cmd+Z` / `Cmd+Shift+Z` (provider) |
| `reset` | Defaults — clears project |
| `loadDraftState` / `loadTemplateState` | Replace present (+ UI flags) from payload |

Ephemeral UI (drag flags, selected ids, playhead) is generally **outside** the undoable present or excluded from snapshots carefully.

---

## Provider lifecycle

```mermaid
sequenceDiagram
  participant P as EditorProvider
  participant IDB as IndexedDB
  participant Z as Zustand

  P->>P: ?template= URL → loadTemplateState (wins)
  alt no template
    P->>IDB: readEditorDraft
    IDB-->>P: snapshot
    P->>Z: applyEditorDraft
  end
  loop edits
    Z-->>P: subscribe
    P->>IDB: writeEditorDraft (250ms debounce)
  end
  Note over P: Flush before login / leave when needed
```

Also wires global shortcuts (copy canvas as PNG, undo/redo) and template apply toast. Full shortcut catalog: [shortcuts.md](./shortcuts.md). Bulk/preview flags: [bulk-preview.md](./bulk-preview.md).

---

## Key action groups

| Domain | Examples |
|---|---|
| Canvases | `addCanvas`, `removeCanvas`, `duplicateCanvas`, `setActiveCanvasId` |
| Screenshot | `setScreenshot`, `applyCroppedScreenshot`, `setFullPageScreenshot`, slots |
| Style | `setBackground`, `setPadding`, `setBorder`, `setTilt`, `setShadow`, … |
| Layers | `addText`, `updateAsset`, `addAnnotationStroke`, z-order helpers |
| Animation | clip CRUD, `setIsAnimateMode`, duration, easing |
| Bulk / preview | `setBulkEditMode`, `setIsPreviewMode`, preview animation |
| Presets | `setActiveLayoutPresetId`, custom preset cache mutators |
| Draft UI | `setCurrentDraft`, `loadDraftState` |

Full list: `EditorActions` in `store/types.ts` (+ `CLAUDE.md` summary).

---

## Persistence boundary

| What | Where |
|---|---|
| Full project autosave | IndexedDB — [drafts.md](./drafts.md) |
| Named cloud projects | D1 + R2 drafts |
| Style-only snapshots | custom presets (no pixels) |
| Curated starters | templates (repo JSON) |

Screenshots/backgrounds are extracted to `screenshot-blobs` on IDB write (`@idb:` sentinels). Videos stay as blobs / draft media URLs.

---

## Key files

| Path | Role |
|---|---|
| `lib/editor/store.tsx` | Public exports and store composition root |
| `lib/editor/state-types.ts` | Types |
| `lib/editor/value-schemas.ts` | Input validation ranges |
| `lib/editor/store/types.ts` | Root state and action contracts |
| `lib/editor/store/commit-context.ts` | Shared history and canvas commit primitives |
| `lib/editor/store/animation-helpers.ts` | Clip pose capture, restoration, and keyframe resolution |
| `lib/editor/store/actions/` | Domain action factories |
| `lib/editor/store/provider.tsx` | Mount lifecycle |
| `lib/editor/store/draft-persistence.ts` | IDB |
| `lib/editor/store/defaults.ts` | `DEFAULT_CANVAS_BASE`, defaults |
| `lib/editor/store/layer-stack.ts` | z-index ordering |
| `lib/schemas/draft.ts` | Cloud/local draft payload schema |
