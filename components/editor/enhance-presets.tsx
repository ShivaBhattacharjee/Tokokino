"use client"

import * as React from "react"

import { enhanceFilterCss } from "@/lib/editor/css-utils"
import { isVideoSrc } from "@/lib/editor/media-type"
import { useVideoRegistry } from "@/lib/editor/video-registry"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
  type EnhancePreset,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

export const ENHANCE_PRESETS: { id: EnhancePreset; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "auto", label: "Auto" },
  { id: "vivid", label: "Vivid" },
  { id: "soft", label: "Soft" },
  { id: "dramatic", label: "Dramatic" },
  { id: "sharp", label: "Sharp" },
]

// Reference chart shown when the canvas has nothing to sample: hard-edged
// primaries over a black-to-white step wedge, so saturation and contrast shifts
// are readable at thumbnail size. Soft gradients wash the difference out.
const CHART_CHIPS =
  "linear-gradient(90deg,#ff2d55 0 14.28%,#ff9500 0 28.57%,#ffd60a 0 42.86%,#34c759 0 57.14%,#32ade6 0 71.43%,#5e5ce6 0 85.71%,#bf5af2 0 100%)"
const CHART_WEDGE =
  "linear-gradient(90deg,#000 0 16.67%,#333 0 33.33%,#666 0 50%,#999 0 66.67%,#ccc 0 83.33%,#fff 0 100%)"

const CHART_STYLE: React.CSSProperties = {
  backgroundImage: `${CHART_CHIPS}, ${CHART_WEDGE}`,
  backgroundSize: "100% 60%, 100% 40%",
  backgroundPosition: "top center, bottom center",
  backgroundRepeat: "no-repeat",
}

function videoFrameDataUrl(video: HTMLVideoElement): string | null {
  if (video.readyState < 2 || !video.videoWidth) return null
  const width = 160
  const height = Math.max(
    1,
    Math.round((video.videoHeight / video.videoWidth) * width)
  )
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  try {
    ctx.drawImage(video, 0, 0, width, height)
    return canvas.toDataURL("image/jpeg", 0.8)
  } catch {
    return null
  }
}

export function EnhancePresetGrid({ className }: { className?: string }) {
  const enhance = useActiveCanvasField((c) => c.enhance)
  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const slots = useActiveCanvasField((c) => c.screenshotSlots)
  const activeCanvasId = useActiveCanvasId()
  const setEnhance = useEditorStore((s) => s.setEnhance)

  const stillSrc =
    screenshot && !isVideoSrc(screenshot)
      ? screenshot
      : (slots.find((slot) => slot.src && !isVideoSrc(slot.src))?.src ?? null)

  const needsVideoFrame = !stillSrc && isVideoSrc(screenshot)
  // Grabbed once when the panel mounts — the popover/sheet opens fresh each
  // time, so the thumbnail matches whatever frame is on screen.
  const videoFrame = React.useMemo(() => {
    if (!needsVideoFrame) return null
    const video = useVideoRegistry.getState().videos[activeCanvasId]
    return video ? videoFrameDataUrl(video) : null
  }, [activeCanvasId, needsVideoFrame])

  const sample = stillSrc ?? videoFrame

  return (
    <div className={cn("grid grid-cols-3 gap-1.5", className)}>
      {ENHANCE_PRESETS.map((preset) => {
        const active = enhance === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => setEnhance(preset.id)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1 transition-all",
              active
                ? "border-primary/60 bg-primary/5"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <span className="block w-full overflow-hidden rounded-[5px]">
              <span
                className="block aspect-[4/3] w-full bg-cover bg-center"
                style={{
                  ...(sample
                    ? { backgroundImage: `url(${sample})` }
                    : CHART_STYLE),
                  filter: enhanceFilterCss(preset.id),
                }}
              />
            </span>
            <span
              className={cn(
                "text-[9px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {preset.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
