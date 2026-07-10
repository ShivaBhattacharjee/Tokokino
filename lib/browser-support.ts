/**
 * Browser detection for the editor's Chrome-recommended warning.
 * Chromium-based browsers (Chrome, Edge, Brave, Opera, Arc) are treated as
 * supported; Safari and Firefox get the one-time acknowledge modal.
 */

const ACK_STORAGE_KEY = "tokokino:chrome-recommended-ack"

export function isChromiumBrowser(): boolean {
  if (typeof navigator === "undefined") return true

  const ua = navigator.userAgent
  // Exclude iOS Chrome/Firefox/Edge — they are WebKit under the hood.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIos) return false

  // Chromium brands expose userAgentData.brands when available.
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> }
    }
  ).userAgentData?.brands
  if (
    brands?.some((b) =>
      /Chromium|Google Chrome|Microsoft Edge|Brave|Opera/i.test(b.brand)
    )
  ) {
    return true
  }

  // Classic UA fallbacks. Check Firefox/Safari first so "Chrome" substrings
  // inside their UAs (or lack thereof) don't misclassify.
  if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) return false
  if (
    /Safari\//i.test(ua) &&
    !/Chrome\//i.test(ua) &&
    !/Chromium\//i.test(ua)
  ) {
    return false
  }
  return /Chrome\//i.test(ua) || /Chromium\//i.test(ua) || /Edg\//i.test(ua)
}

export function shouldShowChromeRecommendedWarning(): boolean {
  if (typeof window === "undefined") return false
  if (isChromiumBrowser()) return false
  try {
    return localStorage.getItem(ACK_STORAGE_KEY) !== "1"
  } catch {
    return true
  }
}

export function acknowledgeChromeRecommendedWarning(): void {
  try {
    localStorage.setItem(ACK_STORAGE_KEY, "1")
  } catch {
    // private mode / blocked storage — modal just won't reappear this session
  }
}
