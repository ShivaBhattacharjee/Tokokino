"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiAndroidLine,
  RiAppleLine,
  RiArrowRightSLine,
  RiCheckboxBlankCircleLine,
  RiComputerLine,
  RiMacLine,
  RiSearchLine,
  RiSmartphoneLine,
  RiTabletLine,
  RiWindow2Line,
} from "@remixicon/react"

import { ScrollFadeBody } from "@/components/editor/scroll-fade"
import { Input } from "@/components/ui/input"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  DEVICE_MOCKUPS,
  getDeviceMockup,
  getDeviceMockupAsset,
  type DeviceMockup,
} from "@/lib/mockups"
import type { DeviceFrame, FrameOrientation } from "@/lib/editor/store"
import { useActiveCanvasField } from "@/lib/editor/store"
import { BoxEmptyState } from "@/components/editor/canvas/box-empty-state"

const DEVICE_FRAME_EMPTY_VIRTUAL_WIDTH = 280
import {
  deviceMockupSpec,
  mockupScreenClipStyle,
  mockupScreenTransform,
} from "@/components/editor/canvas/helpers"
import { Arc } from "@/components/ui/arc"
import { Chrome } from "@/components/ui/chrome"
import { Safari } from "@/components/ui/safari"
import {
  ARC_BROWSER_FRAME_ID,
  BROWSER_FRAMES,
  CHROME_BROWSER_FRAME_ID,
  getBrowserFrame,
  isBrowserFrame,
} from "@/lib/browser-frame"
import { cn } from "@/lib/utils"

const POP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function useLazyVisible(rootMargin = "200px") {
  const ref = React.useRef<HTMLButtonElement | null>(null)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [rootMargin])
  return { ref, visible }
}

type FrameKind = "browser" | "phone" | "tablet" | "watch" | "desktop" | "none"
type ImageFit = "contain" | "cover" | "fill"

type FrameOption = {
  id: string
  name: string
  w: number
  h: number
  kind: FrameKind
  colors: string[]
  previewSrc: string | null
  rotatePreview: boolean
  isDevice: boolean
}

type FrameSection = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  options: FrameOption[]
}

const FALLBACK_OPTIONS: FrameOption[] = [
  {
    id: "none",
    name: "None",
    w: 0,
    h: 0,
    kind: "none",
    colors: [],
    previewSrc: null,
    rotatePreview: false,
    isDevice: false,
  },
]

const BROWSER_OPTIONS: FrameOption[] = BROWSER_FRAMES.map((frame) => ({
  id: frame.id,
  name: frame.name,
  w: frame.size.w,
  h: frame.size.h,
  kind: "browser",
  colors: [...frame.colors],
  previewSrc: null,
  rotatePreview: false,
  isDevice: false,
}))

const LANDSCAPE_THUMBNAIL_DEVICE_IDS = new Set([
  "ipad_air",
  "ipad_pro_11_m4",
  "ipad_pro_13_m4",
])

const DEVICE_OPTIONS = DEVICE_MOCKUPS.map(deviceToOption).filter(
  (option): option is FrameOption => option !== null
)

const SECTIONS: FrameSection[] = [
  {
    id: "browser",
    label: "Browser",
    icon: RiWindow2Line,
    options: BROWSER_OPTIONS,
  },
  {
    id: "iphone",
    label: "iPhone",
    icon: RiAppleLine,
    options: DEVICE_OPTIONS.filter((o) => o.id.startsWith("iphone")),
  },
  {
    id: "android",
    label: "Android",
    icon: RiAndroidLine,
    options: DEVICE_OPTIONS.filter(
      (o) =>
        o.id.startsWith("pixel") ||
        o.id.startsWith("galaxy") ||
        o.id.startsWith("nothing")
    ),
  },
  {
    id: "tablet",
    label: "iPad",
    icon: RiTabletLine,
    options: DEVICE_OPTIONS.filter((o) => o.id.startsWith("ipad")),
  },
  {
    id: "desktop",
    label: "Desktop",
    icon: RiMacLine,
    options: DEVICE_OPTIONS.filter(
      (o) =>
        o.id.startsWith("macbook") ||
        o.id.startsWith("imac") ||
        o.id.includes("display")
    ),
  },
  {
    id: "watch",
    label: "Watch",
    icon: RiComputerLine,
    options: DEVICE_OPTIONS.filter((o) => o.id.includes("watch")),
  },
  {
    id: "none",
    label: "No frame",
    icon: RiCheckboxBlankCircleLine,
    options: FALLBACK_OPTIONS,
  },
].filter((section) => section.options.length > 0)

const ALL_OPTIONS = SECTIONS.flatMap((s) => s.options)
const BROWSER_TILE_PREVIEW_WIDTH = 112
const BROWSER_TILE_PREVIEW_VIRTUAL_WIDTH = 240

const FRAME_SEARCH_ALIASES: Record<string, string[]> = {
  iphone_17: ["apple"],
  iphone_17_pro: ["apple"],
  iphone_17_pro_max: ["apple"],
  galaxy_s24_ultra: ["samsung", "android"],
  pixel_7: ["google", "android"],
  nothing_phone: ["android"],
  ipad_air: ["apple"],
  ipad_mini: ["apple"],
  ipad_pro_11_m4: ["apple"],
  ipad_pro_13_m4: ["apple"],
  apple_watch_10_42mm_aluminum_sport_band: ["apple", "wearable"],
  apple_watch_ultra_2_natural_alpine: ["apple", "wearable"],
  macbook_air_13_gen_4: ["apple", "laptop"],
  macbook_pro_14__5th_gen: ["apple", "laptop"],
  macbook_pro_16__5th_gen: ["apple", "laptop"],
  imac_24: ["apple", "monitor"],
  pro_display_xdr: ["apple", "monitor"],
  studio_display: ["apple", "monitor"],
}

export function FramePopover({
  value,
  onChange,
  previewImage,
  imageFit = "cover",
}: {
  value: DeviceFrame
  onChange: (frame: DeviceFrame) => void
  previewImage?: string | null
  imageFit?: ImageFit
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const previewScreenshot =
    previewImage === undefined ? screenshot : previewImage

  const current = ALL_OPTIONS.find((o) => o.id === value.id) ?? ALL_OPTIONS[0]
  const currentDevice = getDeviceMockup(current.id)
  const effectiveOrientation = isBrowserFrame(current.id)
    ? "horizontal"
    : value.orientation
  const CurrentIcon =
    SECTIONS.find((s) => s.options.some((o) => o.id === current.id))?.icon ??
    RiSmartphoneLine

  const currentColor = resolveFrameColor(current, currentDevice, value.color)
  const q = query.trim().toLowerCase()
  const matches = (o: FrameOption, section: FrameSection) => {
    if (!q) return true
    const haystack: string[] = [
      o.name,
      section.label,
      section.id,
      o.kind,
      `${o.w}x${o.h}`,
      `${o.w}×${o.h}`,
      ...optionColors(o).map((color) => formatColor(color)),
      ...(FRAME_SEARCH_ALIASES[o.id] ?? []),
    ]
    return haystack.some((entry) => entry.toLowerCase().includes(q))
  }

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    options: s.options.filter((o) => matches(o, s)),
  })).filter((s) => s.options.length > 0)

  const selectFrame = React.useCallback(
    (option: FrameOption) => {
      const device = getDeviceMockup(option.id)
      onChange({
        id: option.id,
        color: resolveFrameColor(option, device, value.color),
        orientation: isBrowserFrame(option.id) ? "horizontal" : "vertical",
      })
    },
    [onChange, value.color]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex h-11 w-full items-center gap-2.5 rounded-lg bg-secondary/40 px-3 text-left transition-colors hover:bg-secondary/70",
            open && "bg-secondary/70"
          )}
        >
          <span className="inline-flex size-5 items-center justify-center text-foreground/60">
            <CurrentIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">
              {current.name}
            </span>
            {current.colors.length > 0 ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {formatColor(currentColor)}
              </span>
            ) : null}
          </span>
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        collisionPadding={8}
        className="flex h-[min(640px,82vh)] max-h-[min(640px,82vh)] w-[min(420px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden bg-popover p-0"
      >
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: POP_EASE, delay: 0.02 }}
          className="relative shrink-0 border-b border-border/60 p-2"
        >
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 !pl-8 text-[12px]"
          />
        </motion.div>

        <ScrollFadeBody
          rootClassName="min-h-0 flex-1"
          className="h-full overscroll-contain p-3"
        >
          {visibleSections.map((section, idx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.32,
                ease: POP_EASE,
                delay: 0.06 + idx * 0.035,
              }}
            >
              {idx !== 0 ? <div className="mt-4 h-px bg-border/50" /> : null}
              <div className="mt-3 mb-2.5 flex items-center gap-1.5 first:mt-0">
                <section.icon className="size-3.5 text-foreground/80" />
                <span className="text-[11px] font-medium tracking-tight">
                  {section.label}
                </span>
                <span className="tabular ml-auto font-mono text-[10px] text-muted-foreground">
                  {section.options.length}
                </span>
              </div>

              <div className={frameSectionGridClass(section.id)}>
                {section.options.map((option) => (
                  <DeviceTile
                    key={option.id}
                    option={option}
                    selectedColor={currentColor}
                    active={value.id === option.id}
                    screenshot={previewScreenshot}
                    imageFit={imageFit}
                    compact={isCompactFrameSection(section.id)}
                    onSelect={selectFrame}
                  />
                ))}
              </div>
            </motion.div>
          ))}

          {visibleSections.length === 0 ? (
            <p className="px-2 py-8 text-center font-mono text-[10px] text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : null}
        </ScrollFadeBody>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: POP_EASE, delay: 0.12 }}
          className="relative z-10 shrink-0 border-t border-border/60 bg-popover p-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            {current.colors.length > 0 ? (
              <div className="w-[160px] max-w-full shrink-0">
                <div className="label-eyebrow mb-1.5 px-1 !text-[9px]">
                  Color
                </div>
                <Select
                  value={currentColor}
                  onValueChange={(color) =>
                    onChange({
                      id: current.id,
                      color,
                      orientation: effectiveOrientation,
                    })
                  }
                >
                  <SelectTrigger
                    className="!h-8 w-full justify-between bg-secondary/40 px-2 text-[12px]"
                    aria-label="Device color"
                  >
                    <ColorOption color={currentColor} />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    position="popper"
                    className="z-[70] min-w-[160px]"
                  >
                    {current.colors.map((color) => (
                      <SelectItem key={color} value={color}>
                        <ColorOption color={color} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {currentDevice &&
              current.kind !== "desktop" &&
              current.kind !== "watch" && (
                <div className="w-[140px] shrink-0">
                  <div className="label-eyebrow mb-1.5 px-1 !text-[9px]">
                    Orientation
                  </div>
                  <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
                    {(["vertical", "horizontal"] as const).map(
                      (orientation) => {
                        const active = effectiveOrientation === orientation
                        return (
                          <button
                            key={orientation}
                            aria-label={formatOrientation(orientation)}
                            title={formatOrientation(orientation)}
                            onClick={() =>
                              onChange({
                                id: current.id,
                                color: currentColor,
                                orientation,
                              })
                            }
                            className={cn(
                              "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 transition-colors",
                              active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground"
                            )}
                          >
                            <OrientGlyph
                              orientation={orientation}
                              active={active}
                            />
                          </button>
                        )
                      }
                    )}
                  </div>
                </div>
              )}
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  )
}

const DeviceTile = React.memo(function DeviceTile({
  option,
  selectedColor,
  active,
  screenshot,
  imageFit,
  compact = false,
  onSelect,
}: {
  option: FrameOption
  selectedColor: string
  active: boolean
  screenshot: string | null
  imageFit: ImageFit
  compact?: boolean
  onSelect: (option: FrameOption) => void
}) {
  const { ref, visible } = useLazyVisible()
  const device = option.isDevice ? getDeviceMockup(option.id) : undefined
  const tileColor = resolveFrameColor(option, device, selectedColor)
  const portraitAsset = option.isDevice
    ? getDeviceMockupAsset(option.id, tileColor, "portrait")
    : null
  const landscapeAsset = option.isDevice
    ? getDeviceMockupAsset(option.id, tileColor, "landscape")
    : null
  const asset = portraitAsset ?? landscapeAsset
  const preview =
    screenshot && asset?.src ? asset.src : (option.previewSrc ?? asset?.src)
  const rotatePreview = screenshot ? false : option.rotatePreview
  const spec = option.isDevice ? deviceMockupSpec(option.id) : null

  return (
    <button
      ref={ref}
      onClick={() => onSelect(option)}
      aria-pressed={active}
      className={cn(
        "group flex w-full flex-col items-center rounded-lg transition-colors",
        compact ? "min-h-[132px] gap-1 p-1.5" : "min-h-[150px] gap-1.5 p-2.5",
        active ? "bg-accent" : "bg-secondary/25 hover:bg-secondary/55"
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-center",
          compact ? "h-[78px]" : "h-[88px]"
        )}
      >
        {!visible ? (
          <div className="h-full w-full rounded-md bg-secondary/30" />
        ) : option.kind === "browser" ? (
          <BrowserTilePreview
            frameId={option.id}
            color={tileColor}
            screenshot={screenshot}
            imageFit={imageFit}
          />
        ) : preview && spec ? (
          <DeviceTilePreview
            spec={spec}
            preview={preview}
            rotatePreview={rotatePreview}
            screenshot={screenshot}
            imageFit={imageFit}
          />
        ) : preview ? (
          <ShimmerImage
            src={preview}
            alt=""
            className="max-h-full max-w-full object-contain drop-shadow-sm"
            loading="lazy"
          />
        ) : (
          <DeviceGlyph kind={option.kind} active={active} />
        )}
      </div>
      <span
        className={cn(
          "line-clamp-2 w-full text-center text-[11px] leading-[1.05rem]",
          compact && "text-[10.5px] leading-[0.95rem]",
          active ? "text-foreground" : "text-foreground/82"
        )}
      >
        {option.name}
      </span>
      <span className="tabular mt-auto pt-1 font-mono text-[10px] text-muted-foreground">
        {option.w && option.h ? `${option.w}×${option.h}` : "bare"}
      </span>
    </button>
  )
})

function isCompactFrameSection(sectionId: string) {
  return (
    sectionId === "iphone" || sectionId === "android" || sectionId === "watch"
  )
}

function frameSectionGridClass(sectionId: string) {
  return cn(
    "grid justify-items-center",
    isCompactFrameSection(sectionId)
      ? "grid-cols-4 gap-x-1 gap-y-2"
      : "grid-cols-3 gap-1.5"
  )
}

const DeviceTilePreview = React.memo(function DeviceTilePreview({
  spec,
  preview,
  rotatePreview,
  screenshot,
  imageFit,
}: {
  spec: ReturnType<typeof deviceMockupSpec>
  preview: string
  rotatePreview: boolean
  screenshot: string | null
  imageFit: ImageFit
}) {
  const screenRef = React.useRef<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = React.useState<number | undefined>(
    undefined
  )

  React.useLayoutEffect(() => {
    const node = screenRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setStageWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="relative h-full drop-shadow-sm"
      style={{ aspectRatio: spec.aspectRatio }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div
          ref={screenRef}
          className="relative w-full overflow-hidden bg-black text-white"
          style={{
            aspectRatio: spec.screen.aspectRatio,
            ...mockupScreenClipStyle(spec.screen, stageWidth),
            transform: mockupScreenTransform(spec.screen),
            backgroundImage: screenshot
              ? undefined
              : "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        >
          {screenshot ? (
            <ShimmerImage
              src={screenshot}
              alt=""
              className={cn(
                "h-full w-full object-center",
                imageFitClassName(imageFit)
              )}
              loading="lazy"
            />
          ) : (
            <ScaledEmptyContent
              stageWidth={stageWidth}
              aspectRatio={spec.screen.aspectRatio}
            />
          )}
        </div>
      </div>
      <ShimmerImage
        src={preview}
        alt=""
        className={cn(
          "pointer-events-none absolute inset-0 z-10 h-full w-full object-contain",
          rotatePreview && "scale-[1.38] rotate-90"
        )}
        loading="lazy"
      />
    </div>
  )
})

const BrowserTilePreview = React.memo(function BrowserTilePreview({
  frameId,
  color,
  screenshot,
  imageFit,
}: {
  frameId: string
  color: string
  screenshot: string | null
  imageFit: ImageFit
}) {
  const frame = getBrowserFrame(frameId)
  const scale = BROWSER_TILE_PREVIEW_WIDTH / BROWSER_TILE_PREVIEW_VIRTUAL_WIDTH

  return (
    <div
      className="relative overflow-hidden drop-shadow-sm"
      style={{
        width: BROWSER_TILE_PREVIEW_WIDTH,
        aspectRatio: frame?.aspectRatio,
      }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          width: BROWSER_TILE_PREVIEW_VIRTUAL_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {frameId === ARC_BROWSER_FRAME_ID ? (
          <Arc
            imageSrc={screenshot ?? frame?.previewImageUrl}
            imageFit={imageFit}
            colorMode={color === "dark" ? "dark" : "light"}
            frameBorderRadius="5px"
            screenBorderRadius="4px"
            className="block w-full"
          />
        ) : frameId === CHROME_BROWSER_FRAME_ID ? (
          <Chrome
            imageSrc={screenshot ?? frame?.previewImageUrl}
            imageFit={imageFit}
            colorMode={color === "dark" ? "dark" : "light"}
            url={screenshot ? frame?.defaultUrl : frame?.previewUrl}
            frameBorderRadius="5px"
            screenBorderRadius="0 0 4px 4px"
            className="block w-full"
          />
        ) : (
          <Safari
            imageSrc={screenshot ?? frame?.previewImageUrl}
            imageFit={imageFit}
            colorMode={color === "dark" ? "dark" : "light"}
            url={screenshot ? frame?.defaultUrl : frame?.previewUrl}
            screenBorderRadius="0 0 4px 4px"
            className="block w-full"
          />
        )}
      </div>
    </div>
  )
})

function imageFitClassName(imageFit: ImageFit) {
  if (imageFit === "contain") return "object-contain"
  if (imageFit === "fill") return "object-fill"
  return "object-cover"
}

function ScaledEmptyContent({
  stageWidth,
  aspectRatio,
}: {
  stageWidth: number | undefined
  aspectRatio: string
}) {
  if (!stageWidth) return null
  const scale = stageWidth / DEVICE_FRAME_EMPTY_VIRTUAL_WIDTH
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{
        width: DEVICE_FRAME_EMPTY_VIRTUAL_WIDTH,
        aspectRatio,
        transform: `scale(${scale})`,
        containerType: "inline-size",
      }}
    >
      <BoxEmptyState presentational onBrowse={() => undefined} />
    </div>
  )
}

function DeviceGlyph({ kind, active }: { kind: FrameKind; active: boolean }) {
  const stroke = active ? "border-foreground/70" : "border-foreground/35"
  const fill = active ? "bg-foreground/10" : "bg-foreground/5"
  const accent = active ? "bg-foreground/70" : "bg-foreground/35"

  if (kind === "none") {
    return (
      <div
        className={cn(
          "relative flex size-[72px] items-center justify-center rounded-[10px] border-2 border-dashed",
          stroke
        )}
      >
        <span className={cn("h-px w-8 rotate-[-45deg]", accent)} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative h-[82px] w-[44px] rounded-[12px] border-2",
        stroke,
        fill
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full",
          accent
        )}
      />
    </div>
  )
}

function OrientGlyph({
  orientation,
  active,
}: {
  orientation: FrameOrientation
  active?: boolean
}) {
  const color = active ? "bg-foreground" : "bg-foreground/50"
  return (
    <span aria-hidden className="flex size-4 items-center justify-center">
      <span
        className={cn(
          "h-3.5 w-2 rounded-[2px] transition-transform",
          color,
          orientation === "horizontal" && "rotate-90"
        )}
      />
    </span>
  )
}

function ColorOption({ color }: { color: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="size-3.5 shrink-0 rounded-full border border-black/10 shadow-sm"
        style={colorSwatchStyle(color)}
      />
      <span className="truncate">{formatColor(color)}</span>
    </span>
  )
}

function deviceToOption(device: DeviceMockup): FrameOption | null {
  const portraitAssets = device.assets.filter(
    (asset) => asset.orientation === "portrait"
  )
  const landscapeAssets = device.assets.filter(
    (asset) => asset.orientation === "landscape"
  )
  const primaryAssets =
    portraitAssets.length > 0 ? portraitAssets : landscapeAssets
  const preview = primaryAssets[0]
  if (!preview) return null

  const size = deviceSize(device.id)
  return {
    id: device.id,
    name: device.name,
    w: size.w,
    h: size.h,
    kind: deviceKind(device.id),
    colors: primaryAssets.map((asset) => asset.color),
    previewSrc: device.thumbnailSrc,
    rotatePreview: LANDSCAPE_THUMBNAIL_DEVICE_IDS.has(device.id),
    isDevice: true,
  }
}

function resolveFrameColor(
  option: FrameOption,
  device: DeviceMockup | undefined,
  color: string
) {
  const availableColors = optionColors(option, device)
  if (availableColors.includes(color)) return color
  return availableColors[0] ?? "black"
}

function optionColors(option: FrameOption, device?: DeviceMockup) {
  if (!device) return option.colors
  const portraitColors = device.assets
    .filter((asset) => asset.orientation === "portrait")
    .map((asset) => asset.color)
  return portraitColors.length > 0 ? portraitColors : device.colors
}

function deviceKind(deviceId: string): FrameKind {
  if (deviceId.includes("watch")) return "watch"
  if (deviceId.startsWith("ipad")) return "tablet"
  if (
    deviceId.startsWith("macbook") ||
    deviceId.startsWith("imac") ||
    deviceId.includes("display")
  ) {
    return "desktop"
  }
  return "phone"
}

function deviceSize(deviceId: string) {
  const sizes: Record<string, { w: number; h: number }> = {
    iphone_17: { w: 402, h: 874 },
    iphone_17_pro: { w: 402, h: 874 },
    iphone_17_pro_max: { w: 440, h: 956 },
    galaxy_s24_ultra: { w: 384, h: 824 },
    nothing_phone: { w: 393, h: 873 },
    pixel_7: { w: 412, h: 892 },
    ipad_air: { w: 820, h: 1180 },
    ipad_mini: { w: 744, h: 1133 },
    ipad_pro_11_m4: { w: 834, h: 1194 },
    ipad_pro_13_m4: { w: 1024, h: 1366 },
    apple_watch_10_42mm_aluminum_sport_band: { w: 198, h: 242 },
    apple_watch_ultra_2_natural_alpine: { w: 205, h: 251 },
    macbook_air_13_gen_4: { w: 1280, h: 832 },
    macbook_pro_14__5th_gen: { w: 1512, h: 982 },
    macbook_pro_16__5th_gen: { w: 1728, h: 1117 },
    imac_24: { w: 1280, h: 720 },
    pro_display_xdr: { w: 1920, h: 1080 },
    studio_display: { w: 1920, h: 1080 },
  }

  return sizes[deviceId] ?? { w: 390, h: 844 }
}

function formatColor(color: string) {
  return color
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

function formatOrientation(orientation: FrameOrientation) {
  return orientation[0].toUpperCase() + orientation.slice(1)
}

function colorSwatchStyle(color: string): React.CSSProperties {
  const colors: Record<string, string> = {
    black: "#111111",
    blue: "#8fc5e8",
    cosmic_orange: "#ff8a3d",
    dark: "#262626",
    dark_green: "#264133",
    deep_blue: "#1d314d",
    gray: "#8a8a86",
    green: "#86a877",
    grey: "#777b82",
    hazel: "#6e7463",
    lavender: "#c9b7df",
    light: "#f7f7f4",
    light_blush: "#efc7c5",
    midnight: "#202637",
    mist_blue: "#bdd4e8",
    natural: "#b7aaa0",
    navy: "#182740",
    obsidian: "#1b1b1d",
    orange: "#f28a45",
    purple: "#9a85c7",
    red: "#d4544d",
    sage: "#a6b9a1",
    silver: "#d6d6d2",
    snow: "#f1f0ea",
    space_gray: "#72716d",
    starlight: "#eee4d6",
    tan: "#b39069",
    white: "#f7f7f4",
    yellow: "#f2d66d",
  }

  if (color === "black") return { background: colors.black }
  if (color === "white" || color === "light" || color === "snow")
    return { background: colors[color] }
  return {
    background:
      colors[color] ??
      "linear-gradient(135deg, #2d2d2d 0 25%, #525252 25% 50%, #2d2d2d 50% 75%, #525252 75%)",
  }
}
