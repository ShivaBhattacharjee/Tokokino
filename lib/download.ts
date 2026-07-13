/**
 * Click a transient anchor to save a file without the event bubbling to
 * document — nextjs-toploader starts its progress bar for any same-origin
 * anchor click, and a download never navigates, so the bar would never
 * complete.
 */
export function triggerAnchorDownload(href: string, filename: string) {
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.addEventListener("click", (e) => e.stopPropagation())
  document.body.appendChild(link)
  link.click()
  link.remove()
}
