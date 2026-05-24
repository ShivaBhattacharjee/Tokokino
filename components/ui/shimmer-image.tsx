"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string
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
      className={cn(shimmer && !loaded && "animate-pulse bg-muted", className)}
      style={style}
    />
  )
})
