import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react"

import { ShimmerImage } from "@/components/ui/shimmer-image"

const ARC_WIDTH = 1228
const ARC_HEIGHT = 728
const SCREEN_X = 14
const SCREEN_Y = 14
const SCREEN_WIDTH = 1200
const SCREEN_HEIGHT = 700

const LEFT_PCT = (SCREEN_X / ARC_WIDTH) * 100
const TOP_PCT = (SCREEN_Y / ARC_HEIGHT) * 100
const WIDTH_PCT = (SCREEN_WIDTH / ARC_WIDTH) * 100
const HEIGHT_PCT = (SCREEN_HEIGHT / ARC_HEIGHT) * 100

type ArcColorMode = "light" | "dark"
type ImageFit = "contain" | "cover" | "fill"

export interface ArcProps extends HTMLAttributes<HTMLDivElement> {
  imageSrc?: string
  videoSrc?: string
  colorMode?: ArcColorMode
  children?: ReactNode
  screenRef?: Ref<HTMLDivElement>
  imageRef?: Ref<HTMLImageElement>
  onImageLoad?: (e: SyntheticEvent<HTMLImageElement>) => void
  imageFit?: ImageFit
  frameBorderRadius?: string | number
  screenBorderRadius?: string | number
  shimmer?: boolean
}

export function Arc({
  imageSrc,
  videoSrc,
  colorMode,
  children,
  screenRef,
  imageRef,
  onImageLoad,
  imageFit = "cover",
  frameBorderRadius = "24px",
  screenBorderRadius = "18px",
  shimmer = true,
  className,
  style,
  ...props
}: ArcProps) {
  const hasVideo = !!videoSrc
  const frameClasses =
    colorMode === "dark"
      ? "bg-[#11161b] shadow-[0_20px_48px_rgba(0,0,0,0.42)] ring-1 ring-white/10"
      : colorMode === "light"
        ? "bg-white shadow-[0_18px_44px_rgba(0,0,0,0.24)] ring-1 ring-black/5"
        : "bg-white shadow-[0_18px_44px_rgba(0,0,0,0.24)] ring-1 ring-black/5 dark:bg-[#11161b] dark:shadow-[0_20px_48px_rgba(0,0,0,0.42)] dark:ring-white/10"
  const screenClasses =
    colorMode === "light"
      ? "bg-white"
      : colorMode === "dark"
        ? "bg-[#060909]"
        : "bg-white dark:bg-[#060909]"
  const frameStyle: CSSProperties =
    colorMode === "dark"
      ? {
          backgroundColor: "#11161b",
          boxShadow: "0 20px 48px rgba(0,0,0,0.42)",
          outline: "1px solid rgba(255,255,255,0.1)",
        }
      : colorMode === "light"
        ? {
            backgroundColor: "#ffffff",
            boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
            outline: "1px solid rgba(0,0,0,0.05)",
          }
        : {}
  const screenStyle: CSSProperties =
    colorMode === "dark"
      ? { backgroundColor: "#060909" }
      : colorMode === "light"
        ? { backgroundColor: "#ffffff" }
        : {}

  const screen = hasVideo ? (
    <video
      className="block size-full object-cover"
      src={videoSrc}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
    />
  ) : imageSrc ? (
    <>
      {/* Blurred backdrop — fills letterbox/pillarbox areas in contain mode */}
      {imageFit === "contain" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
          style={{
            filter: "blur(18px) brightness(0.55) saturate(1.4)",
            transform: "scale(1.12)",
          }}
        />
      )}
      <ShimmerImage
        ref={imageRef}
        shimmer={shimmer}
        src={imageSrc}
        alt=""
        onLoad={onImageLoad}
        className={`relative z-10 block size-full ${imageFitClassName(imageFit)}`}
      />
    </>
  ) : (
    children
  )

  return (
    <div
      className={`relative inline-block w-full overflow-hidden align-middle leading-none ${frameClasses} ${className ?? ""}`}
      style={{
        aspectRatio: `${ARC_WIDTH}/${ARC_HEIGHT}`,
        borderRadius: frameBorderRadius,
        containerType: "inline-size",
        ...frameStyle,
        ...style,
      }}
      {...props}
    >
      <div
        ref={hasVideo ? undefined : screenRef}
        className={`absolute z-0 overflow-hidden ${screenClasses}`}
        style={{
          left: `${LEFT_PCT}%`,
          top: `${TOP_PCT}%`,
          width: `${WIDTH_PCT}%`,
          height: `${HEIGHT_PCT}%`,
          borderRadius: screenBorderRadius,
          ...screenStyle,
        }}
      >
        {screen}
      </div>
    </div>
  )
}

function imageFitClassName(imageFit: ImageFit) {
  if (imageFit === "contain") return "object-contain object-center"
  if (imageFit === "fill") return "object-fill"
  return "object-cover object-top"
}
