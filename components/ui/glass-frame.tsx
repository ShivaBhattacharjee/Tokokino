import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react"

import { VideoIdlePoster } from "@/components/editor/canvas/video-idle-poster"
import { useVideoPreload } from "@/components/editor/canvas/use-video-preload"
import { assignMediaRef } from "@/components/ui/browser-frame-media"
import {
  glassBackdropStyle,
  glassCornerStyle,
  glassScreenClipStyle,
} from "@/components/ui/glass-frame-styles"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import {
  getGlassFrame,
  resolveGlassFrameColor,
  type GlassFrameColor,
  type GlassFrameSpec,
} from "@/lib/glass-frame"
import { cn } from "@/lib/utils"

type ImageFit = "contain" | "cover" | "fill"

export interface GlassFrameProps extends HTMLAttributes<HTMLDivElement> {
  frameId: string
  colorMode?: GlassFrameColor
  imageSrc?: string
  videoSrc?: string
  children?: ReactNode
  screenOverlay?: ReactNode
  screenRef?: Ref<HTMLDivElement>
  imageRef?: Ref<HTMLImageElement>
  onImageLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
  onMediaElement?: (element: HTMLVideoElement | null) => void
  mediaStyle?: CSSProperties
  imageFit?: ImageFit
  shimmer?: boolean
}

type GlassPalette = {
  panelHighlight: string
  panelShadow: string
  layer: string
  layerBorder: string
  layerShadow: string
  screenBackground: string
}

const DARK_GLASS: GlassPalette = {
  panelHighlight: "rgba(255,255,255,0.32)",
  panelShadow: "0 36px 80px rgba(2,6,14,0.42), 0 12px 28px rgba(2,6,14,0.28)",
  layer:
    "linear-gradient(145deg, rgba(255,255,255,0.13), rgba(18,25,38,0.52) 42%, rgba(4,8,15,0.78))",
  layerBorder: "rgba(255,255,255,0.17)",
  layerShadow: "0 24px 60px rgba(2,6,14,0.30)",
  screenBackground: "#0a0c11",
}

const LIGHT_GLASS: GlassPalette = {
  panelHighlight: "rgba(255,255,255,0.96)",
  panelShadow:
    "0 36px 80px rgba(25,35,55,0.20), 0 12px 28px rgba(25,35,55,0.13)",
  layer:
    "linear-gradient(145deg, rgba(255,255,255,0.74), rgba(228,235,245,0.48) 48%, rgba(196,208,225,0.54))",
  layerBorder: "rgba(255,255,255,0.72)",
  layerShadow: "0 24px 60px rgba(25,35,55,0.16)",
  screenBackground: "#e8edf4",
}

export function GlassFrame({
  frameId,
  colorMode,
  imageSrc,
  videoSrc,
  children,
  screenOverlay,
  screenRef,
  imageRef,
  onImageLoad,
  onMediaElement,
  mediaStyle,
  imageFit = "cover",
  shimmer = true,
  className,
  style,
  ...props
}: GlassFrameProps) {
  const videoPreload = useVideoPreload()
  const frame = getGlassFrame(frameId)
  if (!frame) return null

  const resolvedColor = resolveGlassFrameColor(colorMode ?? "dark")
  const palette = resolvedColor === "light" ? LIGHT_GLASS : DARK_GLASS
  const hasMedia = Boolean(videoSrc || imageSrc)

  return (
    <div
      className={cn(
        "relative inline-block w-full overflow-visible align-middle leading-none",
        className
      )}
      style={{
        aspectRatio: frame.aspectRatio,
        containerType: "inline-size",
        isolation: "isolate",
        transform: "translateZ(0)",
        ...style,
      }}
      {...props}
    >
      {frame.layers.map((layer, index) => (
        <div
          key={`${frame.id}-layer-${index}`}
          aria-hidden
          data-glass-frame-layer="rear"
          className="pointer-events-none absolute"
          style={{
            ...rectStyle(frame, layer),
            zIndex: frame.layers.length - index,
            background: palette.layer,
            border: `1px solid ${palette.layerBorder}`,
            boxShadow: palette.layerShadow,
            ...glassBackdropStyle("blur(18px) saturate(135%)"),
            transform: `translateZ(0) rotate(${layer.rotation ?? 0}deg)`,
            transformOrigin: "center",
          }}
        />
      ))}

      <div
        data-glass-frame-shell=""
        data-glass-frame-layer="front"
        className="absolute"
        style={{
          ...rectStyle(frame, frame.front),
          zIndex: 10,
          overflow: "hidden",
          isolation: "isolate",
          background: palette.layer,
          boxShadow: palette.panelShadow,
          ...glassBackdropStyle("blur(18px) saturate(135%)"),
          transform: "translateZ(0)",
        }}
      >
        <div
          ref={screenRef}
          data-glass-frame-screen=""
          className="absolute overflow-hidden"
          style={{
            ...rectStyle(frame, frame.screen),
            zIndex: 20,
            isolation: "isolate",
            backgroundColor: palette.screenBackground,
            transform: "translateZ(0)",
            ...glassScreenClipStyle(),
          }}
        >
          {videoSrc ? (
            <div className="relative size-full bg-black">
              <video
                ref={(node) => {
                  assignMediaRef(
                    imageRef,
                    node as unknown as HTMLImageElement | null
                  )
                  onMediaElement?.(node)
                }}
                src={videoSrc}
                muted
                loop
                playsInline
                preload={videoPreload}
                draggable={false}
                className={`block size-full ${imageFitClassName(imageFit)}`}
                style={mediaStyle}
                onLoadedMetadata={(event) =>
                  onImageLoad?.(
                    event as unknown as SyntheticEvent<HTMLImageElement>
                  )
                }
              />
              <VideoIdlePoster src={videoSrc} />
            </div>
          ) : imageSrc ? (
            <ShimmerImage
              ref={imageRef}
              shimmer={shimmer}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              className={`block size-full ${imageFitClassName(imageFit)}`}
              style={mediaStyle}
            />
          ) : (
            children
          )}

          {screenOverlay}
        </div>

        <div
          aria-hidden
          data-export-frame-chrome=""
          data-glass-frame-layer="chrome"
          className="pointer-events-none absolute"
          style={{
            ...rectStyle(frame, frame.front),
            zIndex: 30,
            borderRadius: "inherit",
            boxShadow: `inset 0 0 0 0.1cqw ${palette.panelHighlight}`,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.13), transparent 24%, transparent 72%, rgba(255,255,255,0.04))",
            transform: "translateZ(0)",
          }}
        />

        {!hasMedia && !children && !screenOverlay ? (
          <div
            aria-hidden
            className="pointer-events-none absolute opacity-60"
            style={{
              ...rectStyle(frame, frame.screen),
              zIndex: 21,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
              backgroundSize: "5cqw 5cqw",
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function rectStyle(
  frame: GlassFrameSpec,
  rect: GlassFrameSpec["front"]
): CSSProperties {
  const { width, height } = frame.size
  return {
    boxSizing: "border-box",
    left: `${(rect.x / width) * 100}%`,
    top: `${(rect.y / height) * 100}%`,
    width: `${(rect.width / width) * 100}%`,
    height: `${(rect.height / height) * 100}%`,
    ...glassCornerStyle((rect.radius / width) * 100),
  }
}

function imageFitClassName(imageFit: ImageFit) {
  if (imageFit === "contain") return "object-contain object-center"
  if (imageFit === "fill") return "object-fill"
  return "object-cover object-center"
}
