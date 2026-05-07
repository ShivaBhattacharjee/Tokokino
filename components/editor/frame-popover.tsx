"use client"

import * as React from "react"
import {
  RiAppleLine,
  RiArrowRightSLine,
  RiCheckboxBlankCircleLine,
  RiComputerLine,
  RiGoogleLine,
  RiMacLine,
  RiSearchLine,
  RiSmartphoneLine,
  RiTabletLine,
} from "@remixicon/react"

import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DEVICE_MOCKUPS,
  getDeviceMockup,
  getDeviceMockupAsset,
  type DeviceMockup,
} from "@/lib/mockups"
import type { DeviceFrame, FrameOrientation } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type FrameKind = "phone" | "tablet" | "watch" | "desktop" | "none"

type FrameOption = {
  id: string
  name: string
  w: number
  h: number
  kind: FrameKind
  colors: string[]
  previewSrc: string | null
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
    isDevice: false,
  },
]

const DEVICE_OPTIONS = DEVICE_MOCKUPS.map(deviceToOption).filter(
  (option): option is FrameOption => option !== null
)

const SECTIONS: FrameSection[] = [
  {
    id: "iphone",
    label: "iPhone",
    icon: RiAppleLine,
    options: DEVICE_OPTIONS.filter((o) => o.id.startsWith("iphone")),
  },
  {
    id: "android",
    label: "Android",
    icon: RiGoogleLine,
    options: DEVICE_OPTIONS.filter(
      (o) =>
        o.id.startsWith("pixel") ||
        o.id.startsWith("galaxy") ||
        o.id.startsWith("nothing")
    ),
  },
  {
    id: "tablet",
    label: "Tablet",
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

export function FramePopover({
  value,
  onChange,
}: {
  value: DeviceFrame
  onChange: (frame: DeviceFrame) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const current = ALL_OPTIONS.find((o) => o.id === value.id) ?? ALL_OPTIONS[0]
  const currentDevice = getDeviceMockup(current.id)
  const CurrentIcon =
    SECTIONS.find((s) => s.options.some((o) => o.id === current.id))?.icon ??
    RiSmartphoneLine

  const currentColor = resolveFrameColor(currentDevice, value.color)
  const q = query.trim().toLowerCase()
  const matches = (o: FrameOption) => {
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      formatColor(value.color).toLowerCase().includes(q) ||
      `${o.w}x${o.h}`.includes(q) ||
      `${o.w}×${o.h}`.includes(q)
    )
  }

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    options: s.options.filter(matches),
  })).filter((s) => s.options.length > 0)

  const selectDevice = (option: FrameOption) => {
    const device = getDeviceMockup(option.id)
    onChange({
      id: option.id,
      color: resolveFrameColor(device, value.color),
      orientation: "vertical",
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex h-11 w-full items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/50 px-3 text-left transition-colors hover:bg-secondary/80",
            open && "bg-secondary/80"
          )}
        >
          <span className="inline-flex size-5 items-center justify-center text-foreground/85">
            <CurrentIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] text-foreground">
              {current.name}
            </span>
            {currentDevice ? (
              <span className="truncate font-mono text-[9px] text-muted-foreground">
                {formatColor(currentColor)}
              </span>
            ) : null}
          </span>
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground transition-transform",
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
        className="flex max-h-[min(640px,82vh)] w-[min(420px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden bg-popover p-0"
      >
        <div className="relative shrink-0 border-b border-border/60 p-2">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 !pl-8 text-[12px]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {visibleSections.map((section, idx) => (
            <React.Fragment key={section.id}>
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

              <div className="grid grid-cols-3 gap-2">
                {section.options.map((option) => (
                  <DeviceTile
                    key={option.id}
                    option={option}
                    selectedColor={currentColor}
                    active={value.id === option.id}
                    onSelect={() => {
                      selectDevice(option)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}

          {visibleSections.length === 0 ? (
            <p className="px-2 py-8 text-center font-mono text-[10px] text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-popover p-2">
          {currentDevice ? (
            <>
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="label-eyebrow !text-[9px]">Color</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {formatColor(currentColor)}
                </span>
              </div>
              <div className="mb-2 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                {current.colors.map((color) => {
                  const active = color === currentColor
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={formatColor(color)}
                      aria-pressed={active}
                      title={formatColor(color)}
                      onClick={() =>
                        onChange({
                          id: current.id,
                          color,
                          orientation: "vertical",
                        })
                      }
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border transition-all",
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                          : "border-border/70 bg-secondary/50 hover:border-foreground/30"
                      )}
                    >
                      <span
                        className="size-5 rounded-full border border-black/10 shadow-sm"
                        style={colorSwatchStyle(color)}
                      />
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}

          <div className="label-eyebrow mb-1.5 px-1 !text-[9px]">
            Orientation
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
            {(["vertical", "horizontal"] as const).map((orientation) => {
              const active = orientation === "vertical"
              const disabled = orientation === "horizontal"
              return (
                <button
                  key={orientation}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      id: current.id,
                      color: currentColor,
                      orientation,
                    })
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] capitalize transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                    disabled && "cursor-not-allowed opacity-35"
                  )}
                >
                  <OrientGlyph orientation={orientation} active={active} />
                  {orientation}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 px-1 font-mono text-[10px] text-muted-foreground">
            Horizontal mockups are parked until the landscape fit is tuned.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DeviceTile({
  option,
  selectedColor,
  active,
  onSelect,
}: {
  option: FrameOption
  selectedColor: string
  active: boolean
  onSelect: () => void
}) {
  const preview = option.isDevice
    ? (getDeviceMockupAsset(option.id, selectedColor, "portrait")?.src ??
      option.previewSrc)
    : option.previewSrc

  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex min-h-[168px] flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors",
        active
          ? "border-foreground/35 bg-accent"
          : "border-border/60 bg-secondary/25 hover:border-foreground/25 hover:bg-secondary/55"
      )}
    >
      <div className="flex h-[88px] w-full items-center justify-center">
        {preview ? (
          <img
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
          "line-clamp-2 min-h-[2.1em] w-full text-center text-[11px] leading-[1.05rem]",
          active ? "text-foreground" : "text-foreground/82"
        )}
      >
        {option.name}
      </span>
      <span className="tabular font-mono text-[10px] text-muted-foreground">
        {option.w && option.h ? `${option.w}×${option.h}` : "bare"}
      </span>
    </button>
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

function deviceToOption(device: DeviceMockup): FrameOption | null {
  const portraitAssets = device.assets.filter(
    (asset) => asset.orientation === "portrait"
  )
  const preview = portraitAssets[0]
  if (!preview) return null

  const size = deviceSize(device.id)
  return {
    id: device.id,
    name: device.name,
    w: size.w,
    h: size.h,
    kind: deviceKind(device.id),
    colors: portraitAssets.map((asset) => asset.color),
    previewSrc: preview.src,
    isDevice: true,
  }
}

function resolveFrameColor(device: DeviceMockup | undefined, color: string) {
  if (!device) return color || "black"
  const portraitColors = device.assets
    .filter((asset) => asset.orientation === "portrait")
    .map((asset) => asset.color)
  if (portraitColors.includes(color)) return color
  return portraitColors[0] ?? device.colors[0] ?? "black"
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

function colorSwatchStyle(color: string): React.CSSProperties {
  const colors: Record<string, string> = {
    black: "#111111",
    blue: "#8fc5e8",
    cosmic_orange: "#ff8a3d",
    dark_green: "#264133",
    deep_blue: "#1d314d",
    gray: "#8a8a86",
    green: "#86a877",
    grey: "#777b82",
    hazel: "#6e7463",
    lavender: "#c9b7df",
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
  if (color === "white" || color === "snow")
    return { background: colors[color] }
  return {
    background:
      colors[color] ??
      "linear-gradient(135deg, #2d2d2d 0 25%, #525252 25% 50%, #2d2d2d 50% 75%, #525252 75%)",
  }
}
