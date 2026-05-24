import * as React from "react"
import type { PercentCrop } from "react-image-crop"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  ImageCrop,
  ImageCropContent,
  ImageCropApply,
  ImageCropReset,
} from "@/components/kibo-ui/image-crop"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CropRegion } from "@/lib/editor/store"

function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(",")
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : "image/png"
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

function isDataUrl(src: string) {
  return src.startsWith("data:")
}

async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || "image/png" })
}

type Preset = {
  label: string
  aspect: number
  w: number
  h: number
}

const PRESETS: Preset[] = [
  { label: "1:1", aspect: 1, w: 14, h: 14 },
  { label: "4:3", aspect: 4 / 3, w: 18, h: 13.5 },
  { label: "3:2", aspect: 3 / 2, w: 18, h: 12 },
  { label: "16:10", aspect: 16 / 10, w: 18, h: 11.25 },
  { label: "16:9", aspect: 16 / 9, w: 18, h: 10.125 },
  { label: "5:4", aspect: 5 / 4, w: 16, h: 12.8 },
  { label: "4:5", aspect: 4 / 5, w: 12.8, h: 16 },
]

export function CropModal({
  open,
  onOpenChange,
  screenshotUrl,
  initialRegion,
  targetAspect,
  onCrop,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenshotUrl: string | null
  initialRegion?: CropRegion | null
  targetAspect?: number | null
  onCrop: (croppedBase64: string, region: CropRegion) => void
}) {
  const safeTargetAspect =
    targetAspect && Number.isFinite(targetAspect) && targetAspect > 0
      ? targetAspect
      : null
  const defaultAspect = safeTargetAspect ?? 16 / 10
  const [aspectOverride, setAspectOverride] = React.useState<{
    defaultAspect: number
    aspect: number
  } | null>(null)
  const [loadedFile, setLoadedFile] = React.useState<{
    url: string
    file: File
  } | null>(null)
  const aspect =
    aspectOverride?.defaultAspect === defaultAspect
      ? aspectOverride.aspect
      : defaultAspect
  const setAspect = React.useCallback(
    (nextAspect: number) => {
      setAspectOverride({ defaultAspect, aspect: nextAspect })
    },
    [defaultAspect]
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setAspectOverride(null)
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const dataUrlFile = React.useMemo(() => {
    if (!open || !screenshotUrl || !isDataUrl(screenshotUrl)) return null
    try {
      return dataURLtoFile(screenshotUrl, "screenshot.png")
    } catch {
      return null
    }
  }, [open, screenshotUrl])

  React.useEffect(() => {
    if (!open || !screenshotUrl || isDataUrl(screenshotUrl)) return

    let cancelled = false
    void urlToFile(screenshotUrl, "screenshot.png").then((file) => {
      if (!cancelled) setLoadedFile({ url: screenshotUrl, file })
    })

    return () => {
      cancelled = true
    }
  }, [open, screenshotUrl])

  const file =
    dataUrlFile ??
    (open && loadedFile?.url === screenshotUrl ? loadedFile.file : null)

  const initialPercentCrop = React.useMemo<PercentCrop | undefined>(() => {
    if (!initialRegion) return undefined
    return { unit: "%", ...initialRegion }
  }, [initialRegion])

  const targetPreset = React.useMemo<Preset>(() => {
    const ratio = defaultAspect
    const longSide = 18
    const shortSide = longSide / ratio
    return ratio >= 1
      ? {
          label: "Canvas",
          aspect: ratio,
          w: longSide,
          h: Math.max(8, Math.min(18, shortSide)),
        }
      : {
          label: "Canvas",
          aspect: ratio,
          w: Math.max(8, Math.min(18, longSide * ratio)),
          h: longSide,
        }
  }, [defaultAspect])

  const presets = React.useMemo(() => {
    const rest = PRESETS.filter(
      (preset) => Math.abs(preset.aspect - targetPreset.aspect) > 0.01
    )
    return [targetPreset, ...rest]
  }, [targetPreset])

  if (!file) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-2xl sm:max-w-[760px]"
      >
        <DialogTitle className="sr-only">Crop screenshot</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              Crop screenshot
            </span>
            <span className="text-[11px] text-muted-foreground">
              Drag the handles or pick a preset ratio
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <ImageCrop
          key={aspect}
          file={file}
          aspect={aspect}
          keepSelection
          initialCrop={
            Math.abs(aspect - targetPreset.aspect) < 0.01
              ? initialPercentCrop
              : undefined
          }
          onCrop={(croppedImage, region) => {
            onCrop(croppedImage, {
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
            })
            handleOpenChange(false)
          }}
        >
          {/* Cropper Area */}
          <div
            className="relative flex flex-1 items-center justify-center px-6 py-8"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
              backgroundSize: "14px 14px",
            }}
          >
            <ImageCropContent className="max-h-[420px] max-w-full rounded-lg" />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-4 border-t border-border/50 bg-background/40 px-4 py-3">
            {/* Aspect chips */}
            <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {presets.map((p) => {
                const isActive = Math.abs(aspect - p.aspect) < 0.01
                return (
                  <button
                    key={p.label}
                    onClick={() => setAspect(p.aspect)}
                    className={cn(
                      "group flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium tracking-tight transition-all",
                      isActive
                        ? "border-foreground/80 bg-foreground text-background"
                        : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground"
                    )}
                    aria-pressed={isActive}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "block shrink-0 rounded-[2px] border transition-colors",
                        isActive
                          ? "border-background/70"
                          : "border-current opacity-70"
                      )}
                      style={{ width: `${p.w}px`, height: `${p.h}px` }}
                    />
                    <span className="leading-none">{p.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Buttons */}
            <div className="flex shrink-0 items-center gap-2 border-l border-border/50 pl-3">
              <ImageCropReset asChild>
                <Button
                  variant="ghost"
                  className="h-8 cursor-pointer rounded-md px-3 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Reset
                </Button>
              </ImageCropReset>
              <ImageCropApply asChild>
                <Button className="h-8 cursor-pointer rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                  Apply crop
                </Button>
              </ImageCropApply>
            </div>
          </div>
        </ImageCrop>
      </DialogContent>
    </Dialog>
  )
}
