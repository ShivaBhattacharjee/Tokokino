"use client"

import * as React from "react"
import {
  RiAppleLine,
  RiArrowRightSLine,
  RiCheckboxBlankCircleLine,
  RiGoogleLine,
  RiMacLine,
  RiSearchLine,
  RiSmartphoneLine,
  RiTabletLine,
  RiWindowLine,
} from "@remixicon/react"

import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type FrameOrientation = "vertical" | "horizontal"

type FrameKind = "phone" | "tablet" | "laptop" | "browser" | "none"

type FrameOption = {
  id: string
  name: string
  w: number
  h: number
  kind: FrameKind
  orientable: boolean
}

type FrameSection = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  options: FrameOption[]
}

const SECTIONS: FrameSection[] = [
  {
    id: "iphone",
    label: "iPhone",
    icon: RiAppleLine,
    options: [
      { id: "iphone-17-pro", name: "iPhone 17 Pro", w: 402, h: 874, kind: "phone", orientable: true },
      { id: "iphone-17-pro-max", name: "iPhone 17 Pro Max", w: 440, h: 956, kind: "phone", orientable: true },
      { id: "iphone-air", name: "iPhone Air", w: 420, h: 912, kind: "phone", orientable: true },
      { id: "iphone-17", name: "iPhone 17", w: 402, h: 874, kind: "phone", orientable: true },
      { id: "iphone-16-pro", name: "iPhone 16 Pro", w: 402, h: 874, kind: "phone", orientable: true },
      { id: "iphone-16", name: "iPhone 16", w: 390, h: 844, kind: "phone", orientable: true },
      { id: "iphone-15-pro", name: "iPhone 15 Pro", w: 393, h: 852, kind: "phone", orientable: true },
    ],
  },
  {
    id: "android",
    label: "Android",
    icon: RiGoogleLine,
    options: [
      { id: "pixel-9-pro", name: "Pixel 9 Pro", w: 412, h: 915, kind: "phone", orientable: true },
      { id: "pixel-9", name: "Pixel 9", w: 412, h: 915, kind: "phone", orientable: true },
      { id: "galaxy-s25", name: "Galaxy S25", w: 360, h: 780, kind: "phone", orientable: true },
    ],
  },
  {
    id: "tablet",
    label: "Tablet",
    icon: RiTabletLine,
    options: [
      { id: "ipad-pro-13", name: "iPad Pro 13″", w: 1024, h: 1366, kind: "tablet", orientable: true },
      { id: "ipad-pro-11", name: "iPad Pro 11″", w: 834, h: 1194, kind: "tablet", orientable: true },
      { id: "ipad-air", name: "iPad Air", w: 820, h: 1180, kind: "tablet", orientable: true },
      { id: "ipad-mini", name: "iPad mini", w: 744, h: 1133, kind: "tablet", orientable: true },
    ],
  },
  {
    id: "laptop",
    label: "Laptop",
    icon: RiMacLine,
    options: [
      { id: "mbp-14", name: "MacBook Pro 14″", w: 1512, h: 982, kind: "laptop", orientable: false },
      { id: "mbp-16", name: "MacBook Pro 16″", w: 1728, h: 1117, kind: "laptop", orientable: false },
      { id: "mba-13", name: "MacBook Air 13″", w: 1440, h: 900, kind: "laptop", orientable: false },
      { id: "imac", name: "iMac 24″", w: 1920, h: 1080, kind: "laptop", orientable: false },
    ],
  },
  {
    id: "browser",
    label: "Browser",
    icon: RiWindowLine,
    options: [
      { id: "browser-light", name: "Browser", w: 1440, h: 900, kind: "browser", orientable: false },
      { id: "browser-safari", name: "Safari", w: 1440, h: 900, kind: "browser", orientable: false },
      { id: "browser-chrome", name: "Chrome", w: 1440, h: 900, kind: "browser", orientable: false },
    ],
  },
  {
    id: "none",
    label: "No frame",
    icon: RiCheckboxBlankCircleLine,
    options: [
      { id: "none", name: "None", w: 0, h: 0, kind: "none", orientable: false },
    ],
  },
]

const ALL_OPTIONS = SECTIONS.flatMap((s) => s.options)

export function FramePopover({
  value,
  orientation,
  onChange,
}: {
  value: string
  orientation: FrameOrientation
  onChange: (id: string, orientation: FrameOrientation) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const current =
    ALL_OPTIONS.find((o) => o.id === value) ?? ALL_OPTIONS[0]
  const CurrentIcon =
    SECTIONS.find((s) => s.options.some((o) => o.id === current.id))?.icon ??
    RiSmartphoneLine

  const q = query.trim().toLowerCase()
  const matches = (o: FrameOption) => {
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      `${o.w}×${o.h}`.includes(q) ||
      `${o.w}x${o.h}`.includes(q)
    )
  }

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    options: s.options.filter(matches),
  })).filter((s) => s.options.length > 0)

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
          <span className="flex-1 truncate text-[13px] text-foreground">
            {current.name}
          </span>
          {current.orientable ? (
            <span className="font-mono text-[10px] text-muted-foreground capitalize">
              {orientation}
            </span>
          ) : null}
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="flex max-h-[min(560px,80vh)] w-[380px] flex-col gap-0 overflow-hidden bg-popover p-0"
      >
        {/* Search */}
        <div className="relative shrink-0 border-b border-border/60 p-2">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 !pl-8 text-[12px]"
          />
        </div>

        {/* Sections */}
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
                {section.options.map((o) => (
                  <DeviceTile
                    key={o.id}
                    option={o}
                    orientation={orientation}
                    active={value === o.id}
                    onSelect={() => {
                      onChange(
                        o.id,
                        o.orientable ? orientation : "vertical"
                      )
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

        {/* Orientation footer */}
        <div className="shrink-0 border-t border-border/60 bg-popover p-2">
          <div className="mb-1.5 px-1 label-eyebrow !text-[9px]">
            Orientation
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
            {(["vertical", "horizontal"] as const).map((o) => {
              const isActive = orientation === o
              const disabled = !current.orientable
              return (
                <button
                  key={o}
                  disabled={disabled}
                  onClick={() => onChange(current.id, o)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] capitalize transition-colors",
                    isActive && !disabled
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                    !disabled && "hover:text-foreground",
                    disabled && "opacity-40"
                  )}
                >
                  <OrientGlyph orientation={o} active={isActive && !disabled} />
                  {o}
                </button>
              )
            })}
          </div>
          {!current.orientable ? (
            <p className="mt-1.5 px-1 font-mono text-[10px] text-muted-foreground">
              {current.name} doesn&apos;t support rotation.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* -------- Device tile -------- */

function DeviceTile({
  option,
  orientation,
  active,
  onSelect,
}: {
  option: FrameOption
  orientation: FrameOrientation
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
        active
          ? "border-foreground/40 bg-accent"
          : "border-border/60 bg-secondary/30 hover:border-foreground/25 hover:bg-secondary/60"
      )}
    >
      <div className="flex h-[96px] w-full items-center justify-center">
        <DeviceGlyph
          kind={option.kind}
          orientation={option.orientable ? orientation : "vertical"}
          active={active}
        />
      </div>
      <span
        className={cn(
          "line-clamp-2 min-h-[2.1em] w-full text-center text-[11px] leading-[1.05rem]",
          active ? "text-foreground" : "text-foreground/85"
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

function DeviceGlyph({
  kind,
  orientation,
  active,
}: {
  kind: FrameKind
  orientation: FrameOrientation
  active: boolean
}) {
  const stroke = active ? "border-foreground/70" : "border-foreground/35"
  const fill = active ? "bg-foreground/10" : "bg-foreground/5"
  const accent = active ? "bg-foreground/70" : "bg-foreground/35"

  if (kind === "phone") {
    const isHorizontal = orientation === "horizontal"
    return (
      <div
        className={cn(
          "relative rounded-[12px] border-2 shadow-sm",
          stroke,
          fill,
          isHorizontal ? "h-[44px] w-[82px]" : "h-[82px] w-[44px]"
        )}
      >
        <span
          className={cn(
            "absolute rounded-full",
            accent,
            isHorizontal
              ? "left-1 top-1/2 h-3 w-1 -translate-y-1/2"
              : "top-1 left-1/2 h-1 w-3 -translate-x-1/2"
          )}
        />
      </div>
    )
  }

  if (kind === "tablet") {
    const isHorizontal = orientation === "horizontal"
    return (
      <div
        className={cn(
          "relative rounded-[10px] border-2 shadow-sm",
          stroke,
          fill,
          isHorizontal ? "h-[56px] w-[80px]" : "h-[80px] w-[60px]"
        )}
      >
        <span
          className={cn(
            "absolute size-1.5 rounded-full",
            accent,
            isHorizontal
              ? "left-1.5 top-1/2 -translate-y-1/2"
              : "top-1.5 left-1/2 -translate-x-1/2"
          )}
        />
      </div>
    )
  }

  if (kind === "laptop") {
    return (
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "relative h-[50px] w-[82px] rounded-[6px] border-2 shadow-sm",
            stroke,
            fill
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 left-1/2 size-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              accent
            )}
          />
        </div>
        <div
          className={cn(
            "mt-[-1px] h-1.5 w-[90px] rounded-b-[4px] border-2 border-t-0",
            stroke,
            "bg-foreground/15"
          )}
        />
      </div>
    )
  }

  if (kind === "browser") {
    return (
      <div
        className={cn(
          "h-[60px] w-[88px] overflow-hidden rounded-[8px] border-2 shadow-sm",
          stroke,
          fill
        )}
      >
        <div
          className={cn(
            "flex h-3 items-center gap-1 border-b-2 px-1.5",
            stroke
          )}
        >
          <span className={cn("size-1 rounded-full", accent)} />
          <span className={cn("size-1 rounded-full opacity-70", accent)} />
          <span className={cn("size-1 rounded-full opacity-40", accent)} />
        </div>
      </div>
    )
  }

  // none
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
          "rounded-[2px]",
          color,
          orientation === "horizontal" ? "h-2 w-3.5" : "h-3.5 w-2"
        )}
      />
    </span>
  )
}
