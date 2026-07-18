/**
 * Layered video-media export stacking.
 *
 * The composite path cannot re-raster the live `<video>` through html-to-image
 * on Safari (flicker). It draws decoded frames in 2D onto a scene template.
 * That breaks anything that should sit *above* the video unless we split the
 * scene into independent passes:
 *
 *   underlay  → backdrop, patterns, outer lighting, underlay overlays, and the
 *               media shell itself (shadow / frame chrome / black plate) — the
 *               video's own pixels are painted by the decoder, not this pass
 *   foreground → inner lighting, overlay textures, text, assets, annotations,
 *                screenshot slots — anything data-export-stack="foreground"
 *
 * Markup: components set `data-export-stack` (see EXPORT_STACK). This module
 * only toggles visibility for the two capture passes.
 */

export const EXPORT_STACK_ATTR = "data-export-stack"

export type ExportStackLayer = "underlay" | "media" | "foreground"

export const EXPORT_STACK = {
  underlay: "underlay",
  media: "media",
  foreground: "foreground",
} as const satisfies Record<ExportStackLayer, ExportStackLayer>

type VisibilityRestore = () => void

function queryStack(root: HTMLElement, layer: ExportStackLayer): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[${EXPORT_STACK_ATTR}="${layer}"]`)
  )
}

export function queryForeground(root: HTMLElement): HTMLElement[] {
  return queryStack(root, "foreground")
}

/**
 * Hide/show layers for one capture pass. Returns a restore function that puts
 * every touched inline style back.
 *
 * - `underlay`: hide videos + foreground, plus any `alsoHide` layers; keep the
 *   backdrop and the media shell, so the shell's shadow, radius and letterbox
 *   plate stay baked in behind the video.
 * - `foreground`: hide the whole tree, then re-show only foreground nodes.
 *   `visibility` inherits and a descendant can override it, so this leaves an
 *   otherwise transparent raster. Hiding by *exclusion* matters: anything
 *   untagged would otherwise paint in both passes and be drawn twice.
 *
 * `alsoHide` exists because WebKit rasterizes a 3D transform inside an SVG
 * foreignObject *without* the perspective divide — it bakes the flat affine
 * projection, while `getBoundingClientRect` (and the editor) use the real
 * perspective one. Any element whose box the transform bends therefore lands in
 * the raster at the wrong shape; those are kept out of the flat passes and
 * projected individually instead.
 */
export function applyExportStackVisibility(
  root: HTMLElement,
  pass: "underlay" | "foreground",
  options: { alsoHide?: HTMLElement[]; only?: HTMLElement[] } = {}
): VisibilityRestore {
  const prev = new Map<HTMLElement, string>()
  const set = (el: HTMLElement, value: string) => {
    if (!prev.has(el)) prev.set(el, el.style.visibility)
    el.style.visibility = value
  }

  const foreground = queryStack(root, "foreground")
  // Main + slot videos — never leave a live <video> for foreignObject to sample.
  const videos = Array.from(root.querySelectorAll<HTMLElement>("video"))

  if (pass === "underlay") {
    for (const el of foreground) set(el, "hidden")
    for (const el of videos) set(el, "hidden")
    for (const el of options.alsoHide ?? []) set(el, "hidden")
  } else {
    set(root, "hidden")
    // `only` narrows the pass to specific elements, so a layer that must be
    // projected by hand can be isolated and captured on its own.
    const only = options.only
    for (const el of only ?? foreground) set(el, "visible")
    // A selected element turns its nested foreground descendants visible too
    // (visibility inherits). Re-hide every foreground node that was not itself
    // selected, so an isolated pass captures only its targets and nested layers
    // are not double-drawn — they composite in their own pass.
    if (only) {
      const selected = new Set(only)
      for (const el of foreground) if (!selected.has(el)) set(el, "hidden")
    }
    // A <video> nested inside a foreground node would come back visible with it.
    for (const el of videos) set(el, "hidden")
  }

  return () => {
    for (const [el, value] of prev) el.style.visibility = value
  }
}

export function countExportStack(root: HTMLElement) {
  return {
    underlay: queryStack(root, "underlay").length,
    media: queryStack(root, "media").length,
    foreground: queryStack(root, "foreground").length,
    videos: root.querySelectorAll("video").length,
  }
}
