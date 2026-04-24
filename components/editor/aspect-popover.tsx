"use client"

import * as React from "react"
import {
  RiAppStoreLine,
  RiArrowRightSLine,
  RiAspectRatioLine,
  RiCropLine,
  RiDribbbleLine,
  RiFacebookLine,
  RiGlobalLine,
  RiGooglePlayLine,
  RiInstagramLine,
  RiLinkedinLine,
  RiRedditLine,
  RiSearchLine,
  RiThreadsLine,
  RiTiktokLine,
  RiTwitterXLine,
  RiYoutubeLine,
} from "@remixicon/react"

import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type AspectOption = {
  id: string
  name: string
  ratio: string
  w: number
  h: number
}

type AspectSection = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  options: AspectOption[]
}

const SECTIONS: AspectSection[] = [
  {
    id: "basic",
    label: "Basic",
    options: [
      { id: "auto", name: "Auto", ratio: "—", w: 0, h: 0 },
      { id: "1-1", name: "Square", ratio: "1:1", w: 1080, h: 1080 },
      { id: "4-3", name: "Standard", ratio: "4:3", w: 1600, h: 1200 },
      { id: "3-2", name: "Classic", ratio: "3:2", w: 1500, h: 1000 },
      { id: "golden", name: "Golden", ratio: "1.618:1", w: 1618, h: 1000 },
      { id: "5-4", name: "Photo", ratio: "5:4", w: 1500, h: 1200 },
      { id: "16-10", name: "Standard", ratio: "16:10", w: 1920, h: 1200 },
      { id: "16-9", name: "Widescreen", ratio: "16:9", w: 1920, h: 1080 },
      { id: "21-9", name: "Ultrawide", ratio: "21:9", w: 2100, h: 900 },
    ],
  },
  {
    id: "x",
    label: "X (Twitter)",
    icon: RiTwitterXLine,
    options: [
      { id: "x-post", name: "Tweet Image", ratio: "16:9", w: 1600, h: 900 },
      { id: "x-header", name: "Header Photo", ratio: "3:1", w: 1500, h: 500 },
    ],
  },
  {
    id: "ig",
    label: "Instagram",
    icon: RiInstagramLine,
    options: [
      { id: "ig-post", name: "Post", ratio: "1:1", w: 1080, h: 1080 },
      { id: "ig-portrait", name: "Portrait", ratio: "4:5", w: 1080, h: 1350 },
      { id: "ig-story", name: "Story", ratio: "9:16", w: 1080, h: 1920 },
      {
        id: "ig-landscape",
        name: "Landscape",
        ratio: "1.91:1",
        w: 1080,
        h: 566,
      },
    ],
  },
  {
    id: "yt",
    label: "YouTube",
    icon: RiYoutubeLine,
    options: [
      { id: "yt-thumb", name: "Thumbnail", ratio: "16:9", w: 1280, h: 720 },
      { id: "yt-short", name: "Short", ratio: "9:16", w: 1080, h: 1920 },
    ],
  },
  {
    id: "tt",
    label: "TikTok",
    icon: RiTiktokLine,
    options: [
      { id: "tt-video", name: "Video", ratio: "9:16", w: 1080, h: 1920 },
    ],
  },
  {
    id: "li",
    label: "LinkedIn",
    icon: RiLinkedinLine,
    options: [
      { id: "li-post", name: "Post", ratio: "1.91:1", w: 1200, h: 627 },
      { id: "li-portrait", name: "Portrait", ratio: "4:5", w: 1080, h: 1350 },
      { id: "li-banner", name: "Banner", ratio: "4:1", w: 1584, h: 396 },
    ],
  },
  {
    id: "fb",
    label: "Facebook",
    icon: RiFacebookLine,
    options: [
      { id: "fb-post", name: "Post", ratio: "1.91:1", w: 1200, h: 630 },
      { id: "fb-portrait", name: "Portrait", ratio: "4:5", w: 1080, h: 1350 },
      { id: "fb-cover", name: "Cover", ratio: "2.63:1", w: 820, h: 312 },
    ],
  },
  {
    id: "th",
    label: "Threads",
    icon: RiThreadsLine,
    options: [
      { id: "th-post", name: "Post", ratio: "1:1", w: 1080, h: 1080 },
      { id: "th-story", name: "Story", ratio: "9:16", w: 1080, h: 1920 },
    ],
  },
  {
    id: "dr",
    label: "Dribbble",
    icon: RiDribbbleLine,
    options: [
      { id: "dr-shot", name: "Shot", ratio: "4:3", w: 1600, h: 1200 },
      { id: "dr-mini", name: "Mini Shot", ratio: "4:3", w: 800, h: 600 },
    ],
  },
  {
    id: "rd",
    label: "Reddit",
    icon: RiRedditLine,
    options: [
      { id: "rd-post", name: "Post", ratio: "16:9", w: 1920, h: 1080 },
      { id: "rd-banner", name: "Banner", ratio: "10:3", w: 1920, h: 384 },
    ],
  },
  {
    id: "og",
    label: "Open Graph",
    icon: RiGlobalLine,
    options: [
      { id: "og-standard", name: "Standard OG", ratio: "1.91:1", w: 1200, h: 630 },
      { id: "og-square", name: "Square OG", ratio: "1:1", w: 1200, h: 1200 },
      { id: "og-x-large", name: "X Large Card", ratio: "2:1", w: 1200, h: 600 },
      { id: "og-x-small", name: "X Small Card", ratio: "1:1", w: 800, h: 800 },
    ],
  },
  {
    id: "app-store",
    label: "App Store",
    icon: RiAppStoreLine,
    options: [
      { id: "as-iphone-69", name: "iPhone 6.9″", ratio: "9:19.5", w: 1290, h: 2796 },
      { id: "as-iphone-67", name: "iPhone 6.7″", ratio: "9:19.5", w: 1284, h: 2778 },
      { id: "as-iphone-65", name: "iPhone 6.5″", ratio: "9:19.5", w: 1242, h: 2688 },
      { id: "as-iphone-55", name: "iPhone 5.5″", ratio: "9:16", w: 1242, h: 2208 },
      { id: "as-ipad-13", name: "iPad 13″", ratio: "3:4", w: 2064, h: 2752 },
      { id: "as-ipad-129", name: "iPad 12.9″", ratio: "3:4", w: 2048, h: 2732 },
      { id: "as-mac", name: "Mac", ratio: "16:10", w: 2880, h: 1800 },
    ],
  },
  {
    id: "play-store",
    label: "Play Store",
    icon: RiGooglePlayLine,
    options: [
      { id: "ps-phone-portrait", name: "Phone Portrait", ratio: "9:16", w: 1080, h: 1920 },
      { id: "ps-phone-landscape", name: "Phone Landscape", ratio: "16:9", w: 1920, h: 1080 },
      { id: "ps-tablet-7", name: "Tablet 7″", ratio: "10:16", w: 1200, h: 1920 },
      { id: "ps-tablet-10", name: "Tablet 10″", ratio: "16:10", w: 1920, h: 1200 },
      { id: "ps-feature", name: "Feature Graphic", ratio: "1024:500", w: 1024, h: 500 },
      { id: "ps-icon", name: "App Icon", ratio: "1:1", w: 512, h: 512 },
    ],
  },
]

const ALL_OPTIONS = SECTIONS.flatMap((s) => s.options)

export function AspectPopover({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string, custom?: { w: number; h: number }) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [w, setW] = React.useState(1920)
  const [h, setH] = React.useState(1200)

  const current =
    ALL_OPTIONS.find((o) => o.id === value) ?? ALL_OPTIONS[0]

  const q = query.trim().toLowerCase()
  const matches = (o: AspectOption) => {
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      o.ratio.toLowerCase().includes(q) ||
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
            <RiCropLine className="size-4" />
          </span>
          <span className="tabular flex-1 text-[13px] text-foreground">
            {current.ratio === "—" ? "Auto" : current.ratio}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {current.w ? `${current.w}×${current.h}` : ""}
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
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="flex max-h-[min(560px,80vh)] w-[min(360px,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden bg-popover p-0"
      >
        {/* Search */}
        <div className="relative shrink-0 border-b border-border/60 p-2">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search ratios…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 !pl-8 text-[12px]"
          />
        </div>

        {/* Sections */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {visibleSections.map((section, idx) => (
            <React.Fragment key={section.id}>
              {section.id !== "basic" ? (
                <div className="mt-5 mb-3 flex items-center gap-1.5">
                  {section.icon ? (
                    <section.icon className="size-3.5 text-foreground/80" />
                  ) : null}
                  <span className="text-[11px] font-medium tracking-tight">
                    {section.label}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
                {section.options.map((o) => (
                  <AspectTile
                    key={o.id}
                    option={o}
                    active={value === o.id}
                    onSelect={() => {
                      onChange(o.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
              {idx === 0 && visibleSections.length > 1 ? (
                <div className="mt-4 h-px bg-border/50" />
              ) : null}
            </React.Fragment>
          ))}

          {visibleSections.length === 0 ? (
            <p className="px-2 py-8 text-center font-mono text-[10px] text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : null}
        </div>

        {/* Custom */}
        <div className="shrink-0 border-t border-border/60 bg-popover p-2">
          <div className="mb-1.5 px-1 label-eyebrow !text-[9px]">
            Custom size
          </div>
          <div className="flex items-center gap-1.5">
            <NumberInput value={w} onChange={setW} label="W" />
            <span className="text-muted-foreground">×</span>
            <NumberInput value={h} onChange={setH} label="H" />
            <button
              onClick={() => {
                onChange("custom", { w, h })
                setOpen(false)
              }}
              className="h-8 shrink-0 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background hover:bg-foreground/90"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AspectTile({
  option,
  active,
  onSelect,
}: {
  option: AspectOption
  active: boolean
  onSelect: () => void
}) {
  const isAuto = option.ratio === "—"
  const [rw, rh] = isAuto ? [1, 1] : option.ratio.split(":").map(Number)

  // Normalize tile size: cap the long edge at ~110px, keep a minimum ~56px
  const LONG = 104
  const SHORT_MIN = 56
  let width: number, height: number
  if (isAuto) {
    width = 64
    height = 64
  } else if (rw >= rh) {
    width = Math.min(LONG, Math.max(SHORT_MIN, (rw / rh) * SHORT_MIN))
    height = SHORT_MIN
  } else {
    height = Math.min(LONG, Math.max(SHORT_MIN, (rh / rw) * SHORT_MIN))
    width = SHORT_MIN
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <button
        onClick={onSelect}
        aria-pressed={active}
        style={{ width, height }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border text-center transition-colors",
          active
            ? "border-transparent bg-foreground text-background"
            : "border-border/60 bg-secondary/60 text-foreground/85 hover:border-foreground/25 hover:bg-secondary"
        )}
      >
        {isAuto ? (
          <RiAspectRatioLine className="size-4" />
        ) : (
          <span className="tabular font-mono text-[11px]">{option.ratio}</span>
        )}
      </button>
      <span
        className={cn(
          "max-w-[9rem] truncate text-[11px] leading-tight",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {option.name}
      </span>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-border/60 bg-secondary/40 px-2 focus-within:border-foreground/40">
      <span className="font-mono text-[10px] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        inputMode="numeric"
        className="tabular min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] outline-none"
      />
      <span className="font-mono text-[10px] text-muted-foreground">px</span>
    </div>
  )
}
