"use client"

import * as React from "react"
import {
  RiAppStoreLine,
  RiArrowRightSLine,
  RiAspectRatioLine,
  RiChromeLine,
  RiCropLine,
  RiDribbbleLine,
  RiFacebookLine,
  RiGlobalLine,
  RiGooglePlayLine,
  RiInstagramLine,
  RiLinkedinLine,
  RiPinterestLine,
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
      { id: "golden", name: "Phi Ratio", ratio: "1.618:1", w: 1618, h: 1000 },
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
      { id: "x-profile", name: "Profile Photo", ratio: "1:1", w: 1080, h: 1080 },
      { id: "x-photo", name: "Photo Post", ratio: "4:5", w: 1200, h: 1500 },
      { id: "x-header", name: "Header Photo", ratio: "3:1", w: 1500, h: 500 },
    ],
  },
  {
    id: "ig",
    label: "Instagram",
    icon: RiInstagramLine,
    options: [
      { id: "ig-post", name: "Square Post", ratio: "1:1", w: 1080, h: 1080 },
      { id: "ig-portrait", name: "Portrait Post", ratio: "4:5", w: 1080, h: 1350 },
      { id: "ig-landscape-post", name: "Landscape Post", ratio: "16:9", w: 1600, h: 900 },
      { id: "ig-story", name: "Story/Reel", ratio: "9:16", w: 1080, h: 1920 },
      {
        id: "ig-carousel",
        name: "Carousel",
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
      { id: "yt-video", name: "Video", ratio: "16:9", w: 1920, h: 1080 },
      { id: "yt-thumb", name: "Thumbnail", ratio: "16:9", w: 1280, h: 720 },
      { id: "yt-short", name: "Shorts", ratio: "9:16", w: 1080, h: 1920 },
      { id: "yt-cover", name: "Channel Cover", ratio: "16:9", w: 2048, h: 1152 },
      { id: "yt-icon", name: "Channel Icon", ratio: "1:1", w: 800, h: 800 },
    ],
  },
  {
    id: "tt",
    label: "TikTok",
    icon: RiTiktokLine,
    options: [
      { id: "tt-post", name: "Post", ratio: "9:16", w: 1080, h: 1920 },
      { id: "tt-photos", name: "Photos", ratio: "1:1", w: 1080, h: 1080 },
      { id: "tt-profile", name: "Profile Photo", ratio: "1:1", w: 1080, h: 1080 },
    ],
  },
  {
    id: "pt",
    label: "Pinterest",
    icon: RiPinterestLine,
    options: [
      { id: "pt-long", name: "Long", ratio: "10:21", w: 1000, h: 2100 },
      { id: "pt-optimal", name: "Optimal", ratio: "2:3", w: 1000, h: 1500 },
      { id: "pt-square", name: "Square", ratio: "1:1", w: 1000, h: 1000 },
    ],
  },
  {
    id: "li",
    label: "LinkedIn",
    icon: RiLinkedinLine,
    options: [
      { id: "li-share", name: "Share Image", ratio: "1.91:1", w: 1200, h: 627 },
      { id: "li-cover", name: "Cover Photo", ratio: "4:1", w: 1584, h: 396 },
      { id: "li-logo", name: "Company Logo", ratio: "1:1", w: 400, h: 400 },
    ],
  },
  {
    id: "fb",
    label: "Facebook",
    icon: RiFacebookLine,
    options: [
      { id: "fb-square", name: "Square Post", ratio: "1:1", w: 1080, h: 1080 },
      { id: "fb-portrait", name: "Portrait Post", ratio: "4:5", w: 1080, h: 1350 },
      { id: "fb-landscape", name: "Landscape Post", ratio: "16:9", w: 1200, h: 675 },
      { id: "fb-story", name: "Story", ratio: "9:16", w: 1080, h: 1920 },
      { id: "fb-cover", name: "Cover Photo", ratio: "16:9", w: 820, h: 461 },
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
      { id: "rd-standard", name: "Standard Post", ratio: "16:9", w: 1600, h: 900 },
      { id: "rd-square", name: "Square Post", ratio: "1:1", w: 1080, h: 1080 },
      { id: "rd-portrait", name: "Portrait Post", ratio: "4:5", w: 1080, h: 1350 },
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
      { id: "as-iphone-67", name: "iPhone 6.7″", ratio: "9:19.5", w: 1284, h: 2778 },
      { id: "as-iphone-65", name: "iPhone 6.5″", ratio: "9:19.5", w: 1242, h: 2688 },
      { id: "as-iphone-61", name: "iPhone 6.1″", ratio: "9:19.5", w: 1179, h: 2556 },
      { id: "as-ipad-129", name: "iPad 12.9″", ratio: "3:4", w: 2048, h: 2732 },
      { id: "as-ipad-11", name: "iPad 11″", ratio: "3:4", w: 1668, h: 2388 },
      { id: "as-apple-tv", name: "Apple TV", ratio: "16:9", w: 1920, h: 1080 },
      { id: "as-mac", name: "Mac", ratio: "16:10", w: 2880, h: 1800 },
    ],
  },
  {
    id: "play-store",
    label: "Play Store",
    icon: RiGooglePlayLine,
    options: [
      { id: "ps-phone", name: "Phone", ratio: "9:16", w: 1080, h: 1920 },
      { id: "ps-icon", name: "App Icon", ratio: "1:1", w: 512, h: 512 },
      { id: "ps-tablet-7", name: "Tablet (7-inch)", ratio: "16:9", w: 1920, h: 1080 },
      { id: "ps-tablet-10", name: "Tablet (10-inch)", ratio: "16:9", w: 1920, h: 1080 },
    ],
  },
  {
    id: "chrome-ext",
    label: "Chrome Extension",
    icon: RiChromeLine,
    options: [
      { id: "ce-store-banner", name: "Store Banner", ratio: "140:56", w: 1400, h: 560 },
      { id: "ce-small-promo", name: "Small Promo", ratio: "44:28", w: 440, h: 280 },
      { id: "ce-large-promo", name: "Large Promo", ratio: "92:68", w: 920, h: 680 },
      { id: "ce-screenshot", name: "Screenshot", ratio: "128:80", w: 1280, h: 800 },
    ],
  },
]

const ALL_OPTIONS = SECTIONS.flatMap((s) => s.options)

export function findAspectOption(id: string) {
  return ALL_OPTIONS.find((o) => o.id === id)
}

export function AspectPopover({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string, custom?: { w: number; h: number }) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [w, setW] = React.useState("1920")
  const [h, setH] = React.useState("1200")

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

  const sectionMatches = (section: AspectSection) => {
    if (!q) return true
    return section.label.toLowerCase().includes(q)
  }

  const visibleSections = SECTIONS.map((s) => {
    const options = sectionMatches(s) ? s.options : s.options.filter(matches)
    return { ...s, options }
  }).filter((s) => s.options.length > 0)

  const customW = Number(w)
  const customH = Number(h)
  const isCustomValid =
    Number.isFinite(customW) &&
    Number.isFinite(customH) &&
    customW > 0 &&
    customH > 0

  const applyCustomSize = () => {
    if (!isCustomValid) return
    onChange("custom", { w: Math.round(customW), h: Math.round(customH) })
    setOpen(false)
  }

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
            <RiCropLine className="size-4" />
          </span>
          <span className="tabular flex-1 text-[13px] font-medium text-foreground">
            {current.ratio === "—" ? "Auto" : current.ratio}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {current.w ? `${current.w}×${current.h}` : ""}
          </span>
          <RiArrowRightSLine className="size-4 text-muted-foreground/60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        collisionPadding={8}
        className="flex max-h-[min(560px,80vh)] w-[min(360px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden bg-popover p-0"
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
            <NumberInput value={w} onChange={setW} label="W" onEnter={applyCustomSize} />
            <span className="text-muted-foreground">×</span>
            <NumberInput value={h} onChange={setH} label="H" onEnter={applyCustomSize} />
            <button
              onClick={applyCustomSize}
              disabled={!isCustomValid}
              className={cn(
                "h-8 shrink-0 rounded-md px-2.5 text-[11px] font-medium",
                isCustomValid
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
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
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  onEnter?: () => void
}) {
  return (
    <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-border/60 bg-secondary/40 px-2 focus-within:border-foreground/40">
      <span className="font-mono text-[10px] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onEnter?.()
          }
        }}
        inputMode="numeric"
        className="tabular min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] outline-none"
      />
      <span className="font-mono text-[10px] text-muted-foreground">px</span>
    </div>
  )
}
