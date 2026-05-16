"use client"

import * as React from "react"
import {
  RiCameraLine,
  RiGlobeLine,
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
          ? "bg-white/18 text-white shadow-sm"
          : "text-white/45 hover:text-white/70"
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
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/50 transition-all hover:bg-white/12 hover:text-white/80 data-[state=open]:bg-white/16 data-[state=open]:text-white"
        >
          <RiSettings3Line className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-[280px] rounded-2xl border border-white/12 bg-black/80 p-0 text-white shadow-2xl ring-0 backdrop-blur-xl"
      >
        <div className="flex flex-col divide-y divide-white/8">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-white/60">Device</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-0.5">
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
            <span className="text-[13px] text-white/60">Aspect Ratio</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-0.5">
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
            <span className="text-[13px] text-white/60">Width</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-0.5">
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
            <span className="text-[13px] text-white/60">Theme</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-0.5">
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
            <span className="text-[13px] text-white/60">Delay</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-0.5">
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
}

export function UploadCard({
  isDragOver = false,
  onBrowse,
  onCapture,
  showHint = false,
  className,
  fluid = false,
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
    } else {
      setUrl(value)
    }
  }

  function handleCapture(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (url === PREFIX) return
    onCapture?.(url, settings)
  }

  if (fluid) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-[2cqw] overflow-hidden rounded-[4cqw] border border-white/12 bg-black/40 p-[2cqw] backdrop-blur-md",
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
          <label className="flex min-h-[8cqw] flex-1 items-center gap-[2cqw] rounded-[2.5cqw] bg-white/[0.06] px-[3cqw] transition-colors focus-within:bg-white/[0.1]">
            <RiGlobeLine className="size-[clamp(0.55rem,1.9cqw,0.8rem)] shrink-0 text-white/40" />
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
              className="min-w-0 flex-1 bg-transparent text-[clamp(0.5rem,1.8cqw,0.78rem)] text-white placeholder:text-white/30 focus:outline-none"
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
          className="flex w-full items-center justify-center gap-[2cqw] rounded-[2.5cqw] bg-white/[0.06] py-[2.5cqw] text-[clamp(0.5rem,1.8cqw,0.78rem)] font-medium text-white/55 transition-all hover:bg-white/10 hover:text-white/85"
        >
          <RiCameraLine className="size-[clamp(0.55rem,1.9cqw,0.8rem)]" />
          Capture Screenshot
        </button>
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
          "flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-[14px] font-semibold tracking-[-0.02em] transition-all",
          isDragOver
            ? "bg-primary/70 text-white"
            : "bg-primary text-white hover:brightness-110 active:brightness-95"
        )}
      >
        <RiUploadLine className="size-4 shrink-0" />
        Upload Screenshot
      </button>
      <div className="flex items-center gap-1.5">
        <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-left transition-colors focus-within:bg-white/[0.1]">
          <RiGlobeLine className="size-4 shrink-0 text-white/40" />
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
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/32 focus:outline-none"
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
          "flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-[13px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/90",
          url === PREFIX && "cursor-default opacity-50"
        )}
      >
        <RiCameraLine className="size-4" />
        Capture Screenshot
      </button>
      {showHint && (
        <div className="-mx-2.5 mt-0.5 -mb-2.5 flex items-center justify-center border-t border-white/8 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
            <kbd className="rounded border border-white/14 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/60">
              ⌘V
            </kbd>
            paste · drop · or click upload
          </span>
        </div>
      )}
    </div>
  )
}
