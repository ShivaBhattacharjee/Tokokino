# Templates

Curated, repo-baked starting compositions shown in the **Templates** gallery
(top bar → Templates). Unlike the per-user custom presets stored in D1,
templates ship with the app: their full editor state lives inline here, and
their poster/preview assets live on R2 at `assets.tokokino.com/templates/`.

## Authoring a template

1. Build the composition in the editor (image or animate mode).
2. Click the dev-only **Copy template** button in the top bar (only rendered
   when `NODE_ENV === "development"`). Enter a kebab-case slug when prompted.
   This:
   - copies the full `DraftPayload` JSON to the clipboard, and
   - publishes a poster to R2 at `templates/<slug>.jpg` via
     `POST /api/templates/thumb` (dev-only), returning its public URL (shown in
     the success toast and logged to the console).
3. For an **animation** template, also record a short loop-friendly preview clip
   and publish it (e.g. upload `templates/<slug>.webm`).
4. Create `lib/editor/templates/<slug>.ts`:

   ```ts
   import type { Template } from "./types"

   const template: Template = {
     id: "<slug>",
     name: "Browser, Light",
     category: "image", // or "animation"
     thumbnail: "https://assets.tokokino.com/templates/<slug>.jpg",
     // preview: "https://assets.tokokino.com/templates/<slug>.webm", // animation only
     state: {
       /* pasted DraftPayload JSON */
     } as Template["state"],
   }

   export default template
   ```

5. Register it in `lib/editor/templates/index.ts` by importing and adding it to
   the `TEMPLATES` array.

Applying a template runs the same restore path as opening a saved draft
(`unwrapDraftState → downloadDraftVideos → loadTemplateState`) but starts a
brand-new, unsaved project.
