"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string
  /** Fill the box with a calm placeholder tint until the image paints. */
  shimmer?: boolean
}

export const ShimmerImage = React.forwardRef<
  HTMLImageElement,
  ShimmerImageProps
>(function ShimmerImage(
  { src, shimmer = true, className, style, onLoad, ...imgProps },
  ref
) {
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  // Runs synchronously after DOM update but before paint, so an already-cached
  // image (or a data: URL) never shows the placeholder at all.
  React.useLayoutEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [src])

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
        // A still tint, deliberately not animated. Any looping animation reads
        // as a blink when the load finishes partway through its cycle, which no
        // start-delay can prevent — a thumbnail grid mostly resolves inside one
        // period, so the effect only ever showed as flicker.
        shimmer && !loaded && "bg-muted",
        className
      )}
      style={style}
    />
  )
})
