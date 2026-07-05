/**
 * Keyboard shortcuts actually wired up in the editor.
 *
 * Sources:
 * - Undo / Redo: lib/editor/store/provider.tsx (⌘Z / ⌘⇧Z, also ⌘Y)
 * - Copy canvas: lib/editor/store/provider.tsx (⌘C)
 * - Paste image: components/editor/canvas/use-image-file-intake.ts (window "paste")
 * - Delete selection: lib/editor/store/provider.tsx (Delete / Backspace)
 * - Deselect / Exit preview: canvas-surface / canvas-view / app preview (Escape)
 *
 * Key tokens are platform-agnostic; `formatShortcutKey` renders the right
 * glyph for macOS vs. other platforms.
 */

export type ShortcutDef = {
  label: string
  keys: string[]
}

export type ShortcutGroup = {
  title: string
  items: ShortcutDef[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "History",
    items: [
      { label: "Undo", keys: ["mod", "Z"] },
      { label: "Redo", keys: ["mod", "shift", "Z"] },
    ],
  },
  {
    title: "Editing",
    items: [
      { label: "Paste image", keys: ["mod", "V"] },
      { label: "Delete selection", keys: ["Delete"] },
      { label: "Deselect / Exit preview", keys: ["Esc"] },
    ],
  },
  {
    title: "Export",
    items: [{ label: "Copy canvas", keys: ["mod", "C"] }],
  },
  {
    title: "Animate",
    items: [
      { label: "Duplicate clip", keys: ["mod", "D"] },
      { label: "Delete clip", keys: ["Delete"] },
    ],
  },
]

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** Render a single key token as a display glyph for the given platform. */
export function formatShortcutKey(key: string, isApple: boolean): string {
  switch (key) {
    case "mod":
      return isApple ? "⌘" : "Ctrl"
    case "shift":
      return isApple ? "⇧" : "Shift"
    case "alt":
      return isApple ? "⌥" : "Alt"
    case "Delete":
      return isApple ? "⌫" : "Del"
    case "Esc":
      return "Esc"
    default:
      return key
  }
}
