"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string
  /** Show an animated theme-aware shimmer until the image paints. Defaults to true. */
  shimmer?: boolean
}

/**
 * Image that shows a light/dark-aware CSS shimmer while the bitmap loads.
 * Uses `--muted` + a soft `--foreground` mix so the sweep tracks the theme
 * without hard-coded hex colors or SVG data URLs.
 */
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

  const showShimmer = shimmer && !loaded

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      ref={setRef}
      src={src}
      alt={imgProps.alt}
      onLoad={handleLoad}
      data-loaded={loaded ? "true" : "false"}
      className={cn(showShimmer && "image-shimmer", className)}
      style={style}
    />
  )
})

/**
 * Standalone shimmer block (no image) — for skeleton grids like Open Project.
 * Same theme tokens as {@link ShimmerImage}.
 */
export function ShimmerBox({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("image-shimmer", className)}
      style={style}
      {...props}
    />
  )
}
