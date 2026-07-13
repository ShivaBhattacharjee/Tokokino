/**
 * `html-to-image` cannot serialize decoded pixels from a `<video>` element.
 * Before a still capture, replace videos in the offscreen clone with canvases
 * painted from their matching live elements. The canvas keeps the clone's
 * layout classes, so crop, frame, and object-fit styling stay unchanged.
 */
export function replaceCloneVideosWithFrames(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement
) {
  const sourceVideos = Array.from(
    sourceRoot.querySelectorAll<HTMLVideoElement>("video")
  )
  const cloneVideos = Array.from(
    cloneRoot.querySelectorAll<HTMLVideoElement>("video")
  )
  let replaced = 0

  for (
    let index = 0;
    index < Math.min(sourceVideos.length, cloneVideos.length);
    index += 1
  ) {
    const source = sourceVideos[index]
    const clone = cloneVideos[index]
    const width = source.videoWidth
    const height = source.videoHeight
    if (!width || !height) continue

    const src = source.currentSrc || source.src
    try {
      const url = new URL(src, window.location.href)
      if (
        url.protocol !== "blob:" &&
        url.protocol !== "data:" &&
        url.origin !== window.location.origin
      ) {
        continue
      }
    } catch {
      continue
    }

    const frame = document.createElement("canvas")
    frame.width = width
    frame.height = height
    for (const attribute of clone.attributes) {
      if (
        attribute.name === "src" ||
        attribute.name === "poster" ||
        attribute.name === "preload"
      ) {
        continue
      }
      frame.setAttribute(attribute.name, attribute.value)
    }

    const context = frame.getContext("2d")
    if (!context) continue
    try {
      context.drawImage(source, 0, 0, width, height)
    } catch {
      continue
    }
    clone.replaceWith(frame)
    replaced += 1
  }

  return replaced
}
