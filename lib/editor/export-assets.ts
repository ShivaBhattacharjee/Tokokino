export function shouldProxyAssetUrl(value: string) {
  const trimmed = value.trim()
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return false
  }

  try {
    const url = new URL(trimmed, window.location.href)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin !== window.location.origin
    )
  } catch {
    return false
  }
}
