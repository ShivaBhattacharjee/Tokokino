"use client"

import * as React from "react"
import {
  RiAddLine,
  RiCameraLine,
  RiLink,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type CaptureDevice = "desktop" | "mobile"
export type CaptureTheme = "light" | "dark"
export type CaptureDelay = "none" | "2s" | "5s"
export type AspectRatio = "4:3" | "16:9" | "1:1"

export type CaptureSettings = {
  device: CaptureDevice
  aspectRatio: AspectRatio
  width: number
  theme: CaptureTheme
  delay: CaptureDelay
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  device: "desktop",
  aspectRatio: "16:9",
  width: 1280,
  theme: "light",
  delay: "none",
}

type ToggleChipProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToggleChip({ active, onClick, children }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "bg-foreground/15 text-foreground shadow-sm"
          : "text-muted-foreground/70 hover:text-foreground/80"
      )}
    >
      {children}
    </button>
  )
}

function CaptureSettingsPopover({
  settings,
  onChange,
}: {
  settings: CaptureSettings
  onChange: <K extends keyof CaptureSettings>(
    key: K,
    value: CaptureSettings[K]
  ) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Capture settings"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-muted-foreground transition-all hover:bg-foreground/12 hover:text-foreground data-[state=open]:bg-foreground/16 data-[state=open]:text-foreground"
        >
          <RiSettings3Line className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-[280px] rounded-2xl border border-border/60 bg-popover/95 p-0 shadow-2xl ring-0 backdrop-blur-xl"
      >
        <div className="flex flex-col divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Device</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-foreground/[0.06] p-0.5">
              <ToggleChip
                active={settings.device === "desktop"}
                onClick={() => onChange("device", "desktop")}
              >
                Desktop
              </ToggleChip>
              <ToggleChip
                active={settings.device === "mobile"}
                onClick={() => onChange("device", "mobile")}
              >
                Mobile
              </ToggleChip>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Aspect Ratio</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-foreground/[0.06] p-0.5">
              {(["4:3", "16:9", "1:1"] as AspectRatio[]).map((r) => (
                <ToggleChip
                  key={r}
                  active={settings.aspectRatio === r}
                  onClick={() => onChange("aspectRatio", r)}
                >
                  {r}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Width</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-foreground/[0.06] p-0.5">
              {([1280, 1440, 1920] as number[]).map((w) => (
                <ToggleChip
                  key={w}
                  active={settings.width === w}
                  onClick={() => onChange("width", w)}
                >
                  {w}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Theme</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-foreground/[0.06] p-0.5">
              <ToggleChip
                active={settings.theme === "light"}
                onClick={() => onChange("theme", "light")}
              >
                Light
              </ToggleChip>
              <ToggleChip
                active={settings.theme === "dark"}
                onClick={() => onChange("theme", "dark")}
              >
                Dark
              </ToggleChip>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Delay</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-foreground/[0.06] p-0.5">
              {(["none", "2s", "5s"] as CaptureDelay[]).map((d) => (
                <ToggleChip
                  key={d}
                  active={settings.delay === d}
                  onClick={() => onChange("delay", d)}
                >
                  {d === "none" ? "None" : d}
                </ToggleChip>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

type UploadCardProps = {
  isDragOver?: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void
  showHint?: boolean
  /** Pass custom className overrides for the outer card shell */
  className?: string
  /** Use cqw-based sizing for container-query contexts (e.g. preset thumbnails) */
  fluid?: boolean
  /** Render only a small trigger icon; full upload UI opens in a popover */
  compact?: boolean
}

export function UploadCard({
  isDragOver = false,
  onBrowse,
  onCapture,
  showHint = false,
  className,
  fluid = false,
  compact = false,
}: UploadCardProps) {
  const PREFIX = "https://"
  const [url, setUrl] = React.useState(PREFIX)
  const [settings, setSettings] = React.useState<CaptureSettings>(
    DEFAULT_CAPTURE_SETTINGS
  )

  function handleSettingChange<K extends keyof CaptureSettings>(
    key: K,
    value: CaptureSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleUrlChange(value: string) {
    if (!value.startsWith(PREFIX)) {
      setUrl(PREFIX)
      return
    }
    // Strip duplicate protocol if user pastes a full URL into the prefixed input
    const body = value.slice(PREFIX.length)
    const stripped = body.replace(/^https?:\/\//i, "")
    setUrl(PREFIX + stripped)
  }

  function handleCapture(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (url === PREFIX) return
    onCapture?.(url, settings)
  }

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Add screenshot"
            className={cn(
              "pointer-events-auto grid place-items-center rounded-2xl border-2 border-primary bg-background/95 text-foreground shadow-[0_0_0_4px_rgba(0,0,0,0.08),0_8px_24px_-8px_rgba(0,0,0,0.15)] backdrop-blur-sm transition-all hover:scale-105 hover:bg-accent active:scale-95 data-[state=open]:scale-105 dark:bg-neutral-900/95 dark:text-white dark:shadow-[0_0_0_4px_rgba(0,0,0,0.4),0_8px_24px_-8px_rgba(0,0,0,0.6)]",
              "size-[clamp(3.5rem,11cqw,7rem)]",
              className
            )}
          >
            <RiAddLine className="size-[55%]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-[320px] rounded-2xl border border-border/60 bg-popover p-0 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
        >
          <UploadCard
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={onCapture}
            showHint={showHint}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (fluid) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-[2cqw] overflow-hidden rounded-[4cqw] border border-border/40 bg-card p-[2cqw] dark:border-white/10 dark:bg-neutral-900",
          className
        )}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onBrowse()
          }}
          className={cn(
            "flex w-full items-center justify-center gap-[2cqw] rounded-[3cqw] px-[4cqw] py-[3cqw] text-[clamp(0.55rem,2.2cqw,0.9rem)] font-semibold text-white transition-all",
            isDragOver
              ? "bg-primary/70"
              : "bg-primary hover:brightness-110 active:brightness-95"
          )}
        >
          <RiUploadLine className="size-[clamp(0.6rem,2cqw,0.85rem)] shrink-0" />
          Upload Screenshot
        </button>
        <div className="flex items-center gap-[1.5cqw]">
          <label
            onPointerDown={(e) => e.stopPropagation()}
            className="flex min-h-[8cqw] flex-1 items-center gap-[2cqw] rounded-[2.5cqw] bg-foreground/[0.06] px-[3cqw] transition-colors focus-within:bg-foreground/[0.1]"
          >
            <RiLink className="size-[clamp(0.55rem,1.9cqw,0.8rem)] shrink-0 text-muted-foreground/60" />
            <input
              type="text"
              inputMode="url"
              placeholder="example.com"
              aria-label="Website URL"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCapture(e)
              }}
              className="min-w-0 flex-1 bg-transparent text-[clamp(0.5rem,1.8cqw,0.78rem)] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </label>
          <CaptureSettingsPopover
            settings={settings}
            onChange={handleSettingChange}
          />
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            handleCapture(e)
          }}
          className="flex w-full items-center justify-center gap-[2cqw] rounded-[2.5cqw] bg-foreground/[0.06] py-[2.5cqw] text-[clamp(0.5rem,1.8cqw,0.78rem)] font-medium text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
        >
          <RiCameraLine className="size-[clamp(0.55rem,1.9cqw,0.8rem)]" />
          Capture Screenshot
        </button>
        {showHint && (
          <div className="-mx-[2cqw] mt-[0.5cqw] -mb-[2cqw] flex items-center justify-center border-t border-border/30 px-[3cqw] py-[2cqw] dark:border-white/8">
            <span className="inline-flex items-center gap-[1.5cqw] text-[clamp(0.45rem,1.4cqw,0.7rem)] text-muted-foreground/50">
              <kbd className="rounded border border-border/50 bg-foreground/[0.06] px-[1.2cqw] py-[0.3cqw] font-mono text-[clamp(0.4rem,1.2cqw,0.62rem)] text-muted-foreground dark:border-white/14 dark:text-white/60">
                ⌘V
              </kbd>
              paste · drop · or click upload
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2 p-2.5", className)}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onBrowse()
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-lg px-5 py-4 text-[14px] font-semibold tracking-[-0.02em] transition-all",
          isDragOver
            ? "bg-primary/70 text-white"
            : "bg-primary text-white hover:brightness-110 active:brightness-95"
        )}
      >
        <RiUploadLine className="size-4 shrink-0" />
        Upload Screenshot
      </button>
      <div className="flex items-center gap-1.5">
        <label
          onPointerDown={(e) => e.stopPropagation()}
          className="flex min-h-10 flex-1 items-center gap-2 rounded-md bg-foreground/[0.06] px-3 text-left transition-colors focus-within:bg-foreground/[0.1]"
        >
          <RiLink className="size-4 shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            inputMode="url"
            placeholder="example.com"
            aria-label="Website URL"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCapture(e)
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <CaptureSettingsPopover
          settings={settings}
          onChange={handleSettingChange}
        />
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => handleCapture(e)}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md bg-foreground/[0.06] py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground",
          url === PREFIX && "cursor-default opacity-50"
        )}
      >
        <RiCameraLine className="size-4" />
        Capture Screenshot
      </button>
      {showHint && (
        <div className="-mx-2.5 mt-0.5 -mb-2.5 flex items-center justify-center border-t border-border/30 px-4 py-2.5 dark:border-white/8">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
            <kbd className="rounded border border-border/50 bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-white/14 dark:text-white/60">
              ⌘V
            </kbd>
            paste · drop · or click upload
          </span>
        </div>
      )}
    </div>
  )
}
