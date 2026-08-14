const SAFARI_TOKEN = /Safari\//
const NON_SAFARI_BROWSER_TOKENS =
  /(?:Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|OPR|SamsungBrowser)\//

export function isSafariUserAgent(userAgent: string): boolean {
  return (
    SAFARI_TOKEN.test(userAgent) && !NON_SAFARI_BROWSER_TOKENS.test(userAgent)
  )
}
