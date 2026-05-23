"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string
}

export const ShimmerImage = React.forwardRef<
  HTMLImageElement,
  ShimmerImageProps
>(function ShimmerImage({ src, className, style, onLoad, ...imgProps }, ref) {
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    setLoaded(false)
  }, [src])

  const handleLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
      onLoad?.(event)
    },
    [onLoad]
  )

  return (
    <img
      {...imgProps}
      ref={ref}
      src={src}
      alt={imgProps.alt}
      onLoad={handleLoad}
      data-loaded={loaded ? "true" : "false"}
      className={cn(!loaded && "animate-pulse bg-muted", className)}
      style={style}
    />
  )
})
