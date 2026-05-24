"use client"

import { Button } from "@/components/ui/button"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { CropIcon, RotateCcwIcon } from "lucide-react"
import { Slot } from "radix-ui"
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
  type ReactCropProps,
} from "react-image-crop"
import { cn } from "@/lib/utils"

import "react-image-crop/dist/ReactCrop.css"

const centerAspectCrop = (
  mediaWidth: number,
  mediaHeight: number,
  aspect: number | undefined
): PercentCrop => {
  if (!aspect) {
    return centerCrop(
      { x: 0, y: 0, width: 90, height: 90, unit: "%" },
      mediaWidth,
      mediaHeight
    )
  }

  const maxFraction = 0.82
  const maxW = mediaWidth * maxFraction
  const maxH = mediaHeight * maxFraction
  const widthFromHeight = maxH * aspect
  const pixelWidth = Math.min(maxW, widthFromHeight)
  const widthPct = (pixelWidth / mediaWidth) * 100

  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: widthPct,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

function cropMatchesAspect(
  crop: PercentCrop,
  mediaWidth: number,
  mediaHeight: number,
  aspect: number | undefined
) {
  if (!aspect) return true
  const cropWidth = (crop.width / 100) * mediaWidth
  const cropHeight = (crop.height / 100) * mediaHeight
  if (!cropWidth || !cropHeight) return false
  return Math.abs(cropWidth / cropHeight - aspect) < 0.01
}

const getCroppedPngImage = async (
  imageSrc: HTMLImageElement,
  pixelCrop: PixelCrop
): Promise<string> => {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Context is null, this should never happen.")
  }

  const scaleX = imageSrc.naturalWidth / imageSrc.width
  const scaleY = imageSrc.naturalHeight / imageSrc.height

  ctx.imageSmoothingEnabled = false
  canvas.width = Math.round(pixelCrop.width * scaleX)
  canvas.height = Math.round(pixelCrop.height * scaleY)

  ctx.drawImage(
    imageSrc,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )

  // Async PNG encode — does not block the main thread like toDataURL.
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    )
  })

  // Async data URL conversion via FileReader (also non-blocking).
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"))
    reader.readAsDataURL(blob)
  })
}

type ImageCropContextType = {
  file: File
  maxImageSize: number
  imgSrc: string
  crop: PercentCrop | undefined
  completedCrop: PixelCrop | null
  imgRef: RefObject<HTMLImageElement | null>
  onCrop?: (croppedImage: string, region: PercentCrop) => void
  reactCropProps: Omit<ReactCropProps, "onChange" | "onComplete" | "children">
  handleChange: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void
  handleComplete: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void
  onImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void
  applyCrop: () => Promise<void>
  resetCrop: () => void
}

const ImageCropContext = createContext<ImageCropContextType | null>(null)

const useImageCrop = () => {
  const context = useContext(ImageCropContext)
  if (!context) {
    throw new Error("ImageCrop components must be used within ImageCrop")
  }
  return context
}

export type ImageCropProps = {
  file: File
  maxImageSize?: number
  onCrop?: (croppedImage: string, region: PercentCrop) => void
  children: ReactNode
  onChange?: ReactCropProps["onChange"]
  onComplete?: ReactCropProps["onComplete"]
  /** Initial crop in percent units. Used in place of the auto-centered crop on first image load. */
  initialCrop?: PercentCrop
} & Omit<ReactCropProps, "onChange" | "onComplete" | "children">

export const ImageCrop = ({
  file,
  maxImageSize = 1024 * 1024 * 5,
  onCrop,
  children,
  onChange,
  onComplete,
  initialCrop: initialCropProp,
  ...reactCropProps
}: ImageCropProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSrc, setImgSrc] = useState<string>("")
  const [crop, setCrop] = useState<PercentCrop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [initialCrop, setInitialCrop] = useState<PercentCrop>()

  useEffect(() => {
    const reader = new FileReader()
    reader.addEventListener("load", () =>
      setImgSrc(typeof reader.result === "string" ? reader.result : "")
    )
    reader.readAsDataURL(file)
  }, [file])

  const onImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget
      const autoCrop = centerAspectCrop(width, height, reactCropProps.aspect)
      const startCrop =
        initialCropProp &&
        cropMatchesAspect(initialCropProp, width, height, reactCropProps.aspect)
          ? initialCropProp
          : autoCrop
      setCrop(startCrop)
      setInitialCrop(startCrop)
    },
    [reactCropProps.aspect, initialCropProp]
  )

  const handleChange = (pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    setCrop(percentCrop)
    onChange?.(pixelCrop, percentCrop)
  }

  const handleComplete = (pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    setCompletedCrop(pixelCrop)
    onComplete?.(pixelCrop, percentCrop)
  }

  const applyCrop = async () => {
    if (!imgRef.current) {
      return
    }

    // Fall back to the current crop if the user hasn't dragged yet
    // (onComplete only fires after a drag, so completedCrop may be null).
    let pixelCrop: PixelCrop | null = completedCrop
    if (!pixelCrop && crop) {
      const { width, height } = imgRef.current
      pixelCrop = {
        unit: "px",
        x: (crop.x / 100) * width,
        y: (crop.y / 100) * height,
        width: (crop.width / 100) * width,
        height: (crop.height / 100) * height,
      }
    }
    if (!pixelCrop || pixelCrop.width === 0 || pixelCrop.height === 0) {
      return
    }

    const croppedImage = await getCroppedPngImage(imgRef.current, pixelCrop)

    if (crop) {
      onCrop?.(croppedImage, crop)
    }
  }

  const resetCrop = () => {
    if (initialCrop) {
      setCrop(initialCrop)
      setCompletedCrop(null)
    }
  }

  const contextValue: ImageCropContextType = {
    file,
    maxImageSize,
    imgSrc,
    crop,
    completedCrop,
    imgRef,
    onCrop,
    reactCropProps,
    handleChange,
    handleComplete,
    onImageLoad,
    applyCrop,
    resetCrop,
  }

  return (
    <ImageCropContext.Provider value={contextValue}>
      {children}
    </ImageCropContext.Provider>
  )
}

export type ImageCropContentProps = {
  style?: CSSProperties
  className?: string
}

export const ImageCropContent = ({
  style,
  className,
}: ImageCropContentProps) => {
  const {
    imgSrc,
    crop,
    handleChange,
    handleComplete,
    onImageLoad,
    imgRef,
    reactCropProps,
  } = useImageCrop()

  const startEdgeResize = useCallback(
    (edge: "n" | "e" | "s" | "w", e: ReactPointerEvent<HTMLDivElement>) => {
      if (!crop || !imgRef.current) return

      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)

      const image = imgRef.current
      const imageRect = image.getBoundingClientRect()
      const mediaW = imageRect.width || image.width
      const mediaH = imageRect.height || image.height
      if (!mediaW || !mediaH) return

      const startCrop = {
        x: (crop.x / 100) * mediaW,
        y: (crop.y / 100) * mediaH,
        width: (crop.width / 100) * mediaW,
        height: (crop.height / 100) * mediaH,
      }
      const startClientX = e.clientX
      const startClientY = e.clientY
      const right = startCrop.x + startCrop.width
      const bottom = startCrop.y + startCrop.height

      const resize = (clientX: number, clientY: number, complete: boolean) => {
        const dx = clientX - startClientX
        const dy = clientY - startClientY
        const aspect = reactCropProps.aspect
        const resizingWidth = edge === "e" || edge === "w"
        const desiredWidth =
          edge === "e"
            ? startCrop.width + dx
            : edge === "w"
              ? startCrop.width - dx
              : startCrop.width
        const desiredHeight =
          edge === "s"
            ? startCrop.height + dy
            : edge === "n"
              ? startCrop.height - dy
              : startCrop.height
        const maxWidth =
          edge === "e" ? mediaW - startCrop.x : edge === "w" ? right : mediaW
        const maxHeight =
          edge === "s" ? mediaH - startCrop.y : edge === "n" ? bottom : mediaH
        const minWidth = Math.min(
          reactCropProps.minWidth ?? Math.min(mediaW, mediaH) * 0.08,
          Math.max(1, maxWidth)
        )
        const minHeight = Math.min(
          reactCropProps.minHeight ?? Math.min(mediaW, mediaH) * 0.08,
          Math.max(1, maxHeight)
        )
        let nextWidth = resizingWidth
          ? Math.max(minWidth, Math.min(maxWidth, desiredWidth))
          : startCrop.width
        let nextHeight = resizingWidth
          ? startCrop.height
          : Math.max(minHeight, Math.min(maxHeight, desiredHeight))
        let nextX = edge === "w" ? right - nextWidth : startCrop.x
        let nextY = edge === "n" ? bottom - nextHeight : startCrop.y

        if (aspect && Number.isFinite(aspect) && aspect > 0) {
          const centerX = startCrop.x + startCrop.width / 2
          const centerY = startCrop.y + startCrop.height / 2
          const centeredMaxWidth = Math.max(
            1,
            2 * Math.min(centerX, mediaW - centerX)
          )
          const centeredMaxHeight = Math.max(
            1,
            2 * Math.min(centerY, mediaH - centerY)
          )
          const aspectMinWidth = Math.max(minWidth, minHeight * aspect)
          const aspectMinHeight = Math.max(minHeight, minWidth / aspect)

          if (resizingWidth) {
            const aspectMaxWidth = Math.min(
              maxWidth,
              centeredMaxHeight * aspect
            )
            nextWidth = Math.max(
              Math.min(aspectMinWidth, aspectMaxWidth),
              Math.min(aspectMaxWidth, desiredWidth)
            )
            nextHeight = nextWidth / aspect
            nextX = edge === "w" ? right - nextWidth : startCrop.x
            nextY = centerY - nextHeight / 2
          } else {
            const aspectMaxHeight = Math.min(
              maxHeight,
              centeredMaxWidth / aspect
            )
            nextHeight = Math.max(
              Math.min(aspectMinHeight, aspectMaxHeight),
              Math.min(aspectMaxHeight, desiredHeight)
            )
            nextWidth = nextHeight * aspect
            nextX = centerX - nextWidth / 2
            nextY = edge === "n" ? bottom - nextHeight : startCrop.y
          }

          nextX = Math.max(0, Math.min(mediaW - nextWidth, nextX))
          nextY = Math.max(0, Math.min(mediaH - nextHeight, nextY))
        }

        const pixelCrop: PixelCrop = {
          unit: "px",
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        }
        const percentCrop: PercentCrop = {
          unit: "%",
          x: (nextX / mediaW) * 100,
          y: (nextY / mediaH) * 100,
          width: (nextWidth / mediaW) * 100,
          height: (nextHeight / mediaH) * 100,
        }

        handleChange(pixelCrop, percentCrop)
        if (complete) handleComplete(pixelCrop, percentCrop)
      }

      const target = e.currentTarget
      const pointerId = e.pointerId
      const onMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        event.preventDefault()
        resize(event.clientX, event.clientY, false)
      }
      const onUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        resize(event.clientX, event.clientY, true)
        cleanup()
      }
      const onCancel = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return
        cleanup()
      }
      const cleanup = () => {
        target.removeEventListener("pointermove", onMove)
        target.removeEventListener("pointerup", onUp)
        target.removeEventListener("pointercancel", onCancel)
        if (target.hasPointerCapture(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
      }

      target.addEventListener("pointermove", onMove)
      target.addEventListener("pointerup", onUp)
      target.addEventListener("pointercancel", onCancel)
    },
    [crop, handleChange, handleComplete, imgRef, reactCropProps]
  )

  const shadcnStyle = {
    "--rc-border-color": "var(--color-border)",
    "--rc-focus-color": "var(--color-primary)",
  } as CSSProperties

  return (
    <ReactCrop
      className={cn("max-h-[277px] max-w-full", className)}
      crop={crop}
      onChange={handleChange}
      onComplete={handleComplete}
      renderSelectionAddon={
        reactCropProps.aspect
          ? () => (
              <>
                <div
                  aria-hidden
                  className="absolute top-0 left-1/2 z-10 flex h-3 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize items-center justify-center gap-0.5 rounded-[2px] border border-border bg-background/80 shadow-sm"
                  onPointerDown={(e) => startEdgeResize("n", e)}
                >
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                </div>
                <div
                  aria-hidden
                  className="absolute top-1/2 right-0 z-10 flex h-9 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize flex-col items-center justify-center gap-0.5 rounded-[2px] border border-border bg-background/80 shadow-sm"
                  onPointerDown={(e) => startEdgeResize("e", e)}
                >
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                </div>
                <div
                  aria-hidden
                  className="absolute bottom-0 left-1/2 z-10 flex h-3 w-9 -translate-x-1/2 translate-y-1/2 cursor-ns-resize items-center justify-center gap-0.5 rounded-[2px] border border-border bg-background/80 shadow-sm"
                  onPointerDown={(e) => startEdgeResize("s", e)}
                >
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                </div>
                <div
                  aria-hidden
                  className="absolute top-1/2 left-0 z-10 flex h-9 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize flex-col items-center justify-center gap-0.5 rounded-[2px] border border-border bg-background/80 shadow-sm"
                  onPointerDown={(e) => startEdgeResize("w", e)}
                >
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                  <span className="size-1 rounded-full bg-foreground/55" />
                </div>
              </>
            )
          : undefined
      }
      style={{ ...shadcnStyle, ...style }}
      {...reactCropProps}
    >
      {imgSrc && (
        <ShimmerImage
          alt="crop"
          className="size-full"
          onLoad={onImageLoad}
          ref={imgRef}
          src={imgSrc}
        />
      )}
    </ReactCrop>
  )
}

export type ImageCropApplyProps = ComponentProps<"button"> & {
  asChild?: boolean
}

export const ImageCropApply = ({
  asChild = false,
  children,
  onClick,
  ...props
}: ImageCropApplyProps) => {
  const { applyCrop } = useImageCrop()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Fire user's onClick first (e.g. close the dialog) so the UI can
    // respond instantly; defer the heavy encode by one tick so the
    // close animation paints before the main thread gets blocked.
    onClick?.(e)
    setTimeout(() => {
      void applyCrop()
    }, 0)
  }

  if (asChild) {
    return (
      <Slot.Root onClick={handleClick} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <Button onClick={handleClick} size="icon" variant="ghost" {...props}>
      {children ?? <CropIcon className="size-4" />}
    </Button>
  )
}

export type ImageCropResetProps = ComponentProps<"button"> & {
  asChild?: boolean
}

export const ImageCropReset = ({
  asChild = false,
  children,
  onClick,
  ...props
}: ImageCropResetProps) => {
  const { resetCrop } = useImageCrop()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    resetCrop()
    onClick?.(e)
  }

  if (asChild) {
    return (
      <Slot.Root onClick={handleClick} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <Button onClick={handleClick} size="icon" variant="ghost" {...props}>
      {children ?? <RotateCcwIcon className="size-4" />}
    </Button>
  )
}

// Keep the original Cropper component for backward compatibility
export type CropperProps = Omit<ReactCropProps, "onChange"> & {
  file: File
  maxImageSize?: number
  onCrop?: (croppedImage: string) => void
  onChange?: ReactCropProps["onChange"]
}

export const Cropper = ({
  onChange,
  onComplete,
  onCrop,
  style,
  className,
  file,
  maxImageSize,
  ...props
}: CropperProps) => (
  <ImageCrop
    file={file}
    maxImageSize={maxImageSize}
    onChange={onChange}
    onComplete={onComplete}
    onCrop={onCrop}
    {...props}
  >
    <ImageCropContent className={className} style={style} />
  </ImageCrop>
)
