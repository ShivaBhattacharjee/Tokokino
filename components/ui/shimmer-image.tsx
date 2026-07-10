"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string
  shimmer?: boolean
  /**
   * How long the image may load before the animated pulse appears. Fast/cached
   * loads resolve first, so the pulse never flashes — which is what made grids
   * of quick thumbnails look like they were flickering. A calm static
   * placeholder still fills the box immediately.
   */
  shimmerDelayMs?: number
}

export const ShimmerImage = React.forwardRef<
  HTMLImageElement,
  ShimmerImageProps
>(function ShimmerImage(
  {
    src,
    shimmer = true,
    shimmerDelayMs = 220,
    className,
    style,
    onLoad,
    ...imgProps
  },
  ref
) {
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [pulse, setPulse] = React.useState(false)

  // Runs synchronously after DOM update but before paint.
  // If the image is already complete (cached / data URL), mark it loaded
  // so the shimmer pulse is never visible to the user.
  React.useLayoutEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [src])

  // Only animate the pulse once the image has been loading for a beat. A quick
  // load flips `loaded` before the timer fires, so the pulse never starts and
  // the tile just shows a still placeholder → no fast flicker.
  React.useEffect(() => {
    if (loaded || !shimmer) {
      setPulse(false)
      return
    }
    const timer = window.setTimeout(() => setPulse(true), shimmerDelayMs)
    return () => window.clearTimeout(timer)
  }, [loaded, shimmer, shimmerDelayMs, src])

  const handleLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
      onLoad?.(event)
    },
    [onLoad]
  )

  const setRef = React.useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      ref={setRef}
      src={src}
      alt={imgProps.alt}
      onLoad={handleLoad}
      data-loaded={loaded ? "true" : "false"}
      className={cn(
        // Still, calm placeholder shows immediately; the pulse only kicks in if
        // the load actually drags on (see the delay above).
        shimmer && !loaded && "bg-muted",
        pulse && !loaded && "animate-pulse",
        className
      )}
      style={style}
    />
  )
})
