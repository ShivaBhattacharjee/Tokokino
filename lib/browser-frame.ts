export const BROWSER_FRAME_ID = "browser"
export const SAFARI_BROWSER_FRAME_ID = BROWSER_FRAME_ID
export const CHROME_BROWSER_FRAME_ID = "chrome"
export const BROWSER_FRAME_DEFAULT_URL = "your-url.com"
export const BROWSER_FRAME_PREVIEW_URL = "https://www.apple.com/in/safari/"
export const BROWSER_FRAME_PREVIEW_IMAGE_URL =
  "https://pub-4a1f61370c844ff69cc9d1a7b3689d25.r2.dev/preview.png"

export const BROWSER_FRAME_COLORS = ["dark", "light"] as const

export type BrowserFrameColor = (typeof BROWSER_FRAME_COLORS)[number]

export const BROWSER_FRAME_IDS = [
  SAFARI_BROWSER_FRAME_ID,
  CHROME_BROWSER_FRAME_ID,
] as const

export type BrowserFrameId = (typeof BROWSER_FRAME_IDS)[number]

export const BROWSER_FRAMES = [
  {
    id: SAFARI_BROWSER_FRAME_ID,
    name: "Safari",
    aspectRatio: "1203 / 753",
    colors: BROWSER_FRAME_COLORS,
    defaultUrl: BROWSER_FRAME_DEFAULT_URL,
    previewUrl: BROWSER_FRAME_PREVIEW_URL,
    previewImageUrl: BROWSER_FRAME_PREVIEW_IMAGE_URL,
    size: { w: 1200, h: 700 },
  },
  {
    id: CHROME_BROWSER_FRAME_ID,
    name: "Chrome",
    aspectRatio: "1202 / 776",
    colors: BROWSER_FRAME_COLORS,
    defaultUrl: BROWSER_FRAME_DEFAULT_URL,
    previewUrl: "https://www.google.com/chrome/",
    previewImageUrl: BROWSER_FRAME_PREVIEW_IMAGE_URL,
    size: { w: 1200, h: 700 },
  },
] as const

export const BROWSER_FRAME_ASPECT_RATIO = BROWSER_FRAMES[0].aspectRatio
export const BROWSER_FRAME_SIZE = BROWSER_FRAMES[0].size

export function getBrowserFrame(id: string) {
  return BROWSER_FRAMES.find((frame) => frame.id === id) ?? null
}

export function isBrowserFrame(id: string) {
  return getBrowserFrame(id) !== null
}

export function resolveBrowserFrameColor(color: string): BrowserFrameColor {
  return color === "light" ? "light" : "dark"
}
