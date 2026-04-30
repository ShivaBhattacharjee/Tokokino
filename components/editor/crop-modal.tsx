import * as React from "react"
import { RiCropLine } from "@remixicon/react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  ImageCrop,
  ImageCropContent,
  ImageCropApply,
  ImageCropReset,
} from "@/components/kibo-ui/image-crop"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

const PRESETS: { label: string; aspect: number | undefined }[] = [
  { label: "Freeform", aspect: undefined },
  { label: "4:3", aspect: 4 / 3 },
  { label: "16:9", aspect: 16 / 9 },
  { label: "16:10", aspect: 16 / 10 },
  { label: "3:2", aspect: 3 / 2 },
  { label: "5:4", aspect: 5 / 4 },
  { label: "4:5", aspect: 4 / 5 },
  { label: "1:1", aspect: 1 },
]

export function CropModal({
  open,
  onOpenChange,
  screenshotUrl,
  onCrop,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenshotUrl: string | null
  onCrop: (croppedBase64: string) => void
}) {
  const [aspect, setAspect] = React.useState<number | undefined>(undefined)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setAspect(undefined)
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const file = React.useMemo(() => {
    if (!open || !screenshotUrl) return null
    return dataURLtoFile(screenshotUrl, "screenshot.png")
  }, [open, screenshotUrl])

  if (!file) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-w-[680px] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-popover p-0 shadow-2xl sm:max-w-[680px] [&_[data-slot=dialog-close]]:transition-none [&_[data-slot=dialog-close]]:active:translate-y-0 [&_[data-slot=dialog-close]]:hover:bg-transparent"
      >
        <DialogTitle className="sr-only">Crop screenshot</DialogTitle>
        {/* Cropper Area */}
        <div className="flex flex-1 flex-col items-center justify-center bg-secondary/30 p-6">
          {/* Key on aspect to force remount & recalculate crop when preset changes */}
          <ImageCrop
            key={aspect ?? "free"}
            file={file}
            aspect={aspect}
            onCrop={(croppedImage) => {
              onCrop(croppedImage)
            }}
          >
            <div className="flex w-full flex-col items-center justify-center">
              <ImageCropContent className="max-h-[380px] max-w-full" />
              <div className="mt-5 flex items-center justify-center gap-3">
                <ImageCropReset asChild>
                  <Button
                    variant="outline"
                    className="h-9 cursor-pointer rounded-lg border-border/60 px-5 text-xs"
                  >
                    Reset
                  </Button>
                </ImageCropReset>
                <ImageCropApply
                  asChild
                  onClick={() => handleOpenChange(false)}
                >
                  <Button className="h-9 cursor-pointer rounded-lg bg-primary px-6 text-xs text-primary-foreground hover:bg-primary/90">
                    Apply Crop
                  </Button>
                </ImageCropApply>
              </div>
            </div>
          </ImageCrop>
        </div>

        {/* Presets Row at Bottom */}
        <div className="flex flex-col gap-2 border-t border-border/50 bg-popover px-4 py-3">
          <span className="text-[11px] font-medium text-muted-foreground tracking-tight">
            Aspect Ratio
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {PRESETS.map((p) => {
              const isActive = aspect === p.aspect
              return (
                <button
                  key={p.label}
                  onClick={() => setAspect(p.aspect)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/60 text-foreground/80 hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {p.label === "Freeform" && (
                    <RiCropLine className="size-3.5" />
                  )}
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
