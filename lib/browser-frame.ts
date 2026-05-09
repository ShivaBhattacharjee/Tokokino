export const BROWSER_FRAME_ID = "browser"
export const BROWSER_FRAME_ASPECT_RATIO = "1203 / 753"
export const BROWSER_FRAME_DEFAULT_URL = "your-url.com"
export const BROWSER_FRAME_PREVIEW_URL = "https://www.apple.com/in/safari/"
export const BROWSER_FRAME_PREVIEW_IMAGE_URL =
  "https://pub-4a1f61370c844ff69cc9d1a7b3689d25.r2.dev/preview.png"

export const BROWSER_FRAME_COLORS = ["white", "dark"] as const

export type BrowserFrameColor = (typeof BROWSER_FRAME_COLORS)[number]

export const BROWSER_FRAME_SIZE = {
  w: 1200,
  h: 700,
} as const

export function isBrowserFrame(id: string) {
  return id === BROWSER_FRAME_ID
}

export function resolveBrowserFrameColor(color: string): BrowserFrameColor {
  return color === "dark" ? "dark" : "white"
}
