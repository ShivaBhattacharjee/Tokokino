"use client"

import * as React from "react"
import {
  RiAddLine,
  RiBlueskyFill,
  RiCameraLine,
  RiLink,
  RiLoader4Line,
  RiSettings3Line,
  RiTwitterXLine,
  RiUploadLine,
} from "@remixicon/react"

import { motion, LayoutGroup } from "motion/react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  TweetFontSelect,
  TweetThemeSelect,
} from "@/components/editor/tweet-font-select"
import { captureUrlSchema } from "@/lib/editor/capture-url"
import { tweetUrlSchema } from "@/lib/editor/tweet-url"
import {
  DEFAULT_TWEET_SETTINGS,
  type TweetCardSettings,
} from "@/lib/editor/tweet-settings"

export type CaptureDevice = "desktop" | "tablet" | "mobile"
export type CaptureDelay = "none" | "2s" | "5s"
export type AspectRatio = "4:3" | "3:4" | "16:9" | "1:1" | "9:16" | "9:19.5"

export type CaptureSettings = {
  device: CaptureDevice
  aspectRatio: AspectRatio
  width: number
  delay: CaptureDelay
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  device: "desktop",
  aspectRatio: "16:9",
  width: 1280,
  delay: "none",
}

// Portrait is the default tablet preset; an iPad frame rotated to landscape
// seeds the landscape preset instead (see initialCaptureSettings).
const TABLET_CAPTURE_DEFAULTS: CaptureSettings = {
  device: "tablet",
  aspectRatio: "3:4",
  width: 834,
  delay: "none",
}

const TABLET_LANDSCAPE_CAPTURE_DEFAULTS: CaptureSettings = {
  device: "tablet",
  aspectRatio: "4:3",
  width: 1024,
  delay: "none",
}

const MOBILE_CAPTURE_DEFAULTS: CaptureSettings = {
  device: "mobile",
  aspectRatio: "9:19.5",
  width: 390,
  delay: "none",
}

function initialCaptureSettings(
  defaultDevice: CaptureDevice | undefined,
  defaultOrientation?: "vertical" | "horizontal"
): CaptureSettings {
  if (defaultDevice === "mobile") return MOBILE_CAPTURE_DEFAULTS
  if (defaultDevice === "tablet") {
    return defaultOrientation === "horizontal"
      ? TABLET_LANDSCAPE_CAPTURE_DEFAULTS
      : TABLET_CAPTURE_DEFAULTS
  }
  return DEFAULT_CAPTURE_SETTINGS
}

const DEVICE_CAPTURE_DEFAULTS: Record<CaptureDevice, CaptureSettings> = {
  desktop: DEFAULT_CAPTURE_SETTINGS,
  tablet: TABLET_CAPTURE_DEFAULTS,
  mobile: MOBILE_CAPTURE_DEFAULTS,
}

const DESKTOP_ASPECT_RATIOS: AspectRatio[] = ["4:3", "16:9", "1:1"]
const TABLET_ASPECT_RATIOS: AspectRatio[] = ["4:3", "3:4", "1:1"]
const MOBILE_ASPECT_RATIOS: AspectRatio[] = ["9:19.5", "9:16", "1:1"]
const DESKTOP_WIDTHS = [1280, 1440, 1920]
const TABLET_WIDTHS = [768, 834, 1024]
const MOBILE_WIDTHS = [390, 414, 430]

function aspectRatiosForDevice(device: CaptureDevice): AspectRatio[] {
  if (device === "mobile") return MOBILE_ASPECT_RATIOS
  if (device === "tablet") return TABLET_ASPECT_RATIOS
  return DESKTOP_ASPECT_RATIOS
}

function widthsForDevice(device: CaptureDevice): number[] {
  if (device === "mobile") return MOBILE_WIDTHS
  if (device === "tablet") return TABLET_WIDTHS
  return DESKTOP_WIDTHS
}

type CaptureSession = {
  url: string
  settings: CaptureSettings
}

const captureSessions = new Map<string, CaptureSession>()
const captureSessionListeners = new Map<
  string,
  Set<(session: CaptureSession | null) => void>
>()

function publishCaptureSession(
  key: string | undefined,
  session: CaptureSession | null
) {
  if (!key) return
  if (session) captureSessions.set(key, session)
  else captureSessions.delete(key)
  captureSessionListeners.get(key)?.forEach((listener) => listener(session))
}

function subscribeCaptureSession(
  key: string | undefined,
  listener: (session: CaptureSession | null) => void
) {
  if (!key) return () => undefined
  const listeners = captureSessionListeners.get(key) ?? new Set()
  listeners.add(listener)
  captureSessionListeners.set(key, listeners)
  listener(captureSessions.get(key) ?? null)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) captureSessionListeners.delete(key)
  }
}

type ToggleChipProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  layoutId: string
}

function ToggleChip({ active, onClick, children, layoutId }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "relative rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "text-neutral-950 dark:text-white"
          : "text-neutral-500 hover:text-neutral-800 dark:text-white/60 dark:hover:text-white/85"
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-md bg-neutral-200 shadow-sm dark:bg-white/15"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function CaptureSettingsPopover({
  settings,
  onChange,
  tweetMode = false,
  tweetSettings,
  onTweetSettingsChange,
  triggerClassName,
  iconClassName,
}: {
  settings: CaptureSettings
  onChange: <K extends keyof CaptureSettings>(
    key: K,
    value: CaptureSettings[K]
  ) => void
  tweetMode?: boolean
  tweetSettings: TweetCardSettings
  onTweetSettingsChange: <K extends keyof TweetCardSettings>(
    key: K,
    value: TweetCardSettings[K]
  ) => void
  triggerClassName?: string
  iconClassName?: string
}) {
  const content = tweetMode ? (
    <div className="flex flex-col divide-y divide-neutral-200 dark:divide-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Theme
        </span>
        <TweetThemeSelect
          value={tweetSettings.theme}
          onValueChange={(value) => onTweetSettingsChange("theme", value)}
          triggerClassName="w-[154px] border-neutral-200 bg-neutral-50 text-neutral-900 shadow-none hover:bg-neutral-100 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
          contentClassName="w-[180px]"
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Avatar
        </span>
        <Switch
          checked={tweetSettings.showAvatar}
          onCheckedChange={(value) =>
            onTweetSettingsChange("showAvatar", value)
          }
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Images
        </span>
        <Switch
          checked={tweetSettings.showImages}
          onCheckedChange={(value) =>
            onTweetSettingsChange("showImages", value)
          }
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Stats
        </span>
        <Switch
          checked={tweetSettings.showMetrics}
          onCheckedChange={(value) =>
            onTweetSettingsChange("showMetrics", value)
          }
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Date & time
        </span>
        <Switch
          checked={tweetSettings.showTimestamp}
          onCheckedChange={(value) =>
            onTweetSettingsChange("showTimestamp", value)
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Font
        </span>
        <TweetFontSelect
          value={tweetSettings.fontFamily}
          onValueChange={(value) => onTweetSettingsChange("fontFamily", value)}
          triggerClassName="w-[154px] border-neutral-200 bg-neutral-50 text-neutral-900 shadow-none hover:bg-neutral-100 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
        />
      </div>
    </div>
  ) : (
    <div className="flex flex-col divide-y divide-neutral-200 dark:divide-white/10">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Device
        </span>
        <LayoutGroup id="capture-device">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-white/8">
            {(["desktop", "tablet", "mobile"] as CaptureDevice[]).map((d) => (
              <ToggleChip
                key={d}
                active={settings.device === d}
                layoutId="capture-device-pill"
                onClick={() => {
                  const defaults = DEVICE_CAPTURE_DEFAULTS[d]
                  onChange("device", d)
                  onChange("aspectRatio", defaults.aspectRatio)
                  onChange("width", defaults.width)
                }}
              >
                {d === "desktop"
                  ? "Desktop"
                  : d === "tablet"
                    ? "Tablet"
                    : "Mobile"}
              </ToggleChip>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Aspect Ratio
        </span>
        <LayoutGroup id="capture-aspect">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-white/8">
            {aspectRatiosForDevice(settings.device).map((r) => (
              <ToggleChip
                key={r}
                active={settings.aspectRatio === r}
                layoutId="capture-aspect-pill"
                onClick={() => onChange("aspectRatio", r)}
              >
                {r}
              </ToggleChip>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Width
        </span>
        <LayoutGroup id="capture-width">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-white/8">
            {widthsForDevice(settings.device).map((w) => (
              <ToggleChip
                key={w}
                active={settings.width === w}
                layoutId="capture-width-pill"
                onClick={() => onChange("width", w)}
              >
                {w}
              </ToggleChip>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-neutral-500 dark:text-white/55">
          Delay
        </span>
        <LayoutGroup id="capture-delay">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-white/8">
            {(["none", "2s", "5s"] as CaptureDelay[]).map((d) => (
              <ToggleChip
                key={d}
                active={settings.delay === d}
                layoutId="capture-delay-pill"
                onClick={() => onChange("delay", d)}
              >
                {d === "none" ? "None" : d}
              </ToggleChip>
            ))}
          </div>
        </LayoutGroup>
      </div>
    </div>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Capture settings"
          className={cn(
            "grid shrink-0 place-items-center border border-neutral-200 bg-neutral-50 text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-800 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-900 dark:border-white/10 dark:bg-white/8 dark:text-white/60 dark:hover:bg-white/12 dark:hover:text-white dark:data-[state=open]:bg-white/15 dark:data-[state=open]:text-white",
            triggerClassName ?? "size-10 rounded-md"
          )}
        >
          <RiSettings3Line className={iconClassName ?? "size-4"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-[280px] rounded-md border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl ring-0 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950 dark:text-white"
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}

type UploadCardProps = {
  isDragOver?: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  /** When provided, X/Twitter status URLs load a tweet card instead of a screenshot. */
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  showHint?: boolean
  /** Pass custom className overrides for the outer card shell */
  className?: string
  /** Use cqw-based sizing for container-query contexts (e.g. preset thumbnails) */
  fluid?: boolean
  /** Render only a small trigger icon; full upload UI opens in a popover */
  compact?: boolean
  /** Seed capture settings for the active frame (e.g. "mobile" when the canvas has a phone frame). */
  defaultDevice?: CaptureDevice
  /** Frame orientation, used to seed a tablet capture as portrait (3:4) vs landscape (4:3). */
  defaultOrientation?: "vertical" | "horizontal"
  /** Keeps URL/loading state alive while a popover closes during capture. */
  captureStateKey?: string
}

export function UploadCard({
  isDragOver = false,
  onBrowse,
  onCapture,
  onLoadTweet,
  showHint = false,
  className,
  fluid = false,
  compact = false,
  defaultDevice,
  defaultOrientation,
  captureStateKey,
}: UploadCardProps) {
  const PREFIX = "https://"
  const [url, setUrl] = React.useState(
    () => captureSessions.get(captureStateKey ?? "")?.url ?? PREFIX
  )
  const [settings, setSettings] = React.useState<CaptureSettings>(
    () =>
      captureSessions.get(captureStateKey ?? "")?.settings ??
      initialCaptureSettings(defaultDevice, defaultOrientation)
  )
  const [tweetSettings, setTweetSettings] = React.useState<TweetCardSettings>(
    DEFAULT_TWEET_SETTINGS
  )
  const [tweetError, setTweetError] = React.useState<string | null>(null)
  const persistedCaptureRef = React.useRef(
    captureSessions.has(captureStateKey ?? "")
  )
  const [isCapturing, setIsCapturing] = React.useState(() =>
    captureSessions.has(captureStateKey ?? "")
  )
  const userTouchedDeviceRef = React.useRef(false)
  React.useEffect(() => {
    if (persistedCaptureRef.current) return
    if (userTouchedDeviceRef.current) return
    setSettings(initialCaptureSettings(defaultDevice, defaultOrientation))
  }, [defaultDevice, defaultOrientation])

  const resetCaptureForm = React.useCallback(() => {
    userTouchedDeviceRef.current = false
    setUrl(PREFIX)
    setSettings(initialCaptureSettings(defaultDevice, defaultOrientation))
    setIsCapturing(false)
  }, [defaultDevice, defaultOrientation])

  React.useEffect(
    () =>
      subscribeCaptureSession(captureStateKey, (session) => {
        if (session) {
          persistedCaptureRef.current = true
          setUrl(session.url)
          setSettings(session.settings)
          setIsCapturing(true)
          return
        }
        if (!persistedCaptureRef.current) return
        persistedCaptureRef.current = false
        resetCaptureForm()
      }),
    [captureStateKey, resetCaptureForm]
  )

  function handleSettingChange<K extends keyof CaptureSettings>(
    key: K,
    value: CaptureSettings[K]
  ) {
    if (key === "device") userTouchedDeviceRef.current = true
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleTweetSettingChange<K extends keyof TweetCardSettings>(
    key: K,
    value: TweetCardSettings[K]
  ) {
    setTweetSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleUrlChange(value: string) {
    setTweetError(null)
    if (!value.startsWith(PREFIX)) {
      setUrl(PREFIX)
      return
    }
    // Strip duplicate protocol if user pastes a full URL into the prefixed input
    const body = value.slice(PREFIX.length)
    const stripped = body.replace(/^https?:\/\//i, "")
    setUrl(PREFIX + stripped)
  }

  const parsedUrl = React.useMemo(() => captureUrlSchema.safeParse(url), [url])
  const parsedTweet = React.useMemo(() => tweetUrlSchema.safeParse(url), [url])
  const socialPostSource = parsedTweet.success
    ? parsedTweet.data.platform
    : null
  const hasUrlInput = url !== PREFIX
  const isTweetUrl = Boolean(onLoadTweet && parsedTweet.success)
  const hasInvalidUrlInput =
    hasUrlInput && !parsedUrl.success && !parsedTweet.success

  async function handleCapture(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (isTweetUrl) {
      if (!onLoadTweet || isCapturing) return
      setIsCapturing(true)
      setTweetError(null)
      try {
        await onLoadTweet(url.trim(), tweetSettings)
        setUrl(PREFIX)
      } catch (err) {
        setTweetError(
          err instanceof Error ? err.message : "Could not load that post"
        )
      } finally {
        setIsCapturing(false)
      }
      return
    }
    if (!parsedUrl.success || isCapturing || !onCapture) return
    const captureUrl = parsedUrl.data
    setUrl(captureUrl)
    persistedCaptureRef.current = Boolean(captureStateKey)
    setIsCapturing(true)
    publishCaptureSession(captureStateKey, {
      url: captureUrl,
      settings,
    })
    try {
      await onCapture(captureUrl, settings)
    } finally {
      publishCaptureSession(captureStateKey, null)
      setIsCapturing(false)
    }
  }

  const captureDisabled = isTweetUrl
    ? isCapturing
    : !onCapture || !parsedUrl.success || isCapturing
  const captureLabel = isCapturing
    ? isTweetUrl
      ? "Loading post…"
      : "Capturing screenshot…"
    : isTweetUrl
      ? socialPostSource === "bluesky"
        ? "Load Bluesky post"
        : "Load X post"
      : "Capture Screenshot"

  const [compactOpen, setCompactOpen] = React.useState(false)
  const compactTriggerRef = React.useRef<HTMLButtonElement>(null)
  const compactContentRef = React.useRef<HTMLDivElement>(null)

  // Canvas pointer handlers call stopPropagation, which blocks Radix's
  // bubble-phase document listener from detecting outside clicks. Use a
  // capture-phase listener instead so it fires before React event processing.
  React.useEffect(() => {
    if (!compact || !compactOpen) return
    function handleCapture(e: PointerEvent) {
      if (compactContentRef.current?.contains(e.target as Node)) return
      if (compactTriggerRef.current?.contains(e.target as Node)) return
      // The capture-settings popover is portaled outside compactContentRef, so
      // clicks on its chips would otherwise read as "outside" and close us.
      // Ignore any pointerdown that lands inside a Radix popper content.
      if (
        e.target instanceof Element &&
        e.target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return
      }
      // Stamp the trigger DOM node synchronously so handleAreaClick (which
      // fires on the subsequent click event, after React has already flushed
      // this close) knows not to reopen the popover.
      compactTriggerRef.current?.setAttribute("data-closing", "true")
      setCompactOpen(false)
    }
    document.addEventListener("pointerdown", handleCapture, true)
    return () =>
      document.removeEventListener("pointerdown", handleCapture, true)
  }, [compact, compactOpen])

  if (compact) {
    return (
      <Popover open={compactOpen} onOpenChange={setCompactOpen}>
        <PopoverAnchor asChild>
          <button
            ref={compactTriggerRef}
            type="button"
            data-upload-compact-trigger
            data-state={compactOpen ? "open" : "closed"}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setCompactOpen(!compactOpen)
            }}
            aria-label="Add screenshot"
            // Counter-scale by the canvas's autoFit so the `+` keeps a
            // consistent on-screen size — without this, tall portrait
            // canvases shrink the button into illegibility.
            style={{
              transform:
                "scale(clamp(1, calc(1 / var(--canvas-fit-scale, 1)), 1.8))",
              transformOrigin: "center",
            }}
            className={cn(
              "pointer-events-auto grid place-items-center rounded-full border-2 border-primary bg-white text-neutral-950 shadow-[0_0_0_3px_rgba(0,0,0,0.06),0_6px_20px_-6px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-[background-color,border-color] hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:shadow-[0_0_0_4px_rgba(0,0,0,0.4),0_8px_24px_-8px_rgba(0,0,0,0.6)] dark:hover:bg-neutral-800",
              "size-10 sm:size-14",
              className
            )}
          >
            <RiAddLine className="size-5 sm:size-7" />
          </button>
        </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          onPointerDown={(e) => e.stopPropagation()}
          onInteractOutside={(e) => {
            if (
              e.target instanceof Node &&
              compactTriggerRef.current?.contains(e.target)
            ) {
              e.preventDefault()
            }
          }}
          className="w-[320px] rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl"
        >
          <div ref={compactContentRef}>
            <UploadCard
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              onCapture={onCapture}
              onLoadTweet={onLoadTweet}
              showHint={showHint}
              defaultDevice={defaultDevice}
              defaultOrientation={defaultOrientation}
              captureStateKey={captureStateKey}
            />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const sizing = fluid ? FLUID_SIZING : DEFAULT_SIZING

  return (
    <div className={cn(sizing.outer, className)}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onBrowse()
        }}
        className={cn(
          sizing.uploadButton,
          isDragOver
            ? "bg-primary/70 text-white"
            : "bg-primary text-white hover:brightness-110 active:brightness-95"
        )}
      >
        <RiUploadLine className={cn(sizing.icon, "shrink-0")} />
        Upload Screenshot
      </button>
      <div className={sizing.urlRow}>
        <label
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            sizing.urlLabel,
            hasInvalidUrlInput &&
              "border-destructive/60 ring-1 ring-destructive/30"
          )}
        >
          <RiLink className={cn(sizing.icon, "shrink-0", sizing.urlIconTint)} />
          <input
            type="text"
            inputMode="url"
            placeholder="example.com"
            aria-label="Website URL"
            aria-invalid={hasInvalidUrlInput}
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCapture(e)
            }}
            className={sizing.urlInput}
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <CaptureSettingsPopover
          settings={settings}
          onChange={handleSettingChange}
          tweetMode={isTweetUrl}
          tweetSettings={tweetSettings}
          onTweetSettingsChange={handleTweetSettingChange}
          triggerClassName={sizing.settingsTrigger}
          iconClassName={sizing.settingsIcon}
        />
      </div>
      <button
        type="button"
        disabled={captureDisabled}
        aria-busy={isCapturing}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          void handleCapture(e)
        }}
        className={cn(
          sizing.captureButton,
          captureDisabled && sizing.captureDisabled
        )}
      >
        {isCapturing ? (
          <RiLoader4Line className={cn(sizing.icon, "animate-spin")} />
        ) : socialPostSource === "bluesky" ? (
          <RiBlueskyFill className={sizing.icon} />
        ) : isTweetUrl ? (
          <RiTwitterXLine className={sizing.icon} />
        ) : (
          <RiCameraLine className={sizing.icon} />
        )}
        {captureLabel}
      </button>
      {tweetError ? (
        <p className="px-1 text-[11px] leading-tight text-destructive">
          {tweetError}
        </p>
      ) : null}
      {showHint && (
        <div className={sizing.hintBox}>
          <span className={sizing.hintText}>
            <kbd className={sizing.hintKbd}>⌘V</kbd>
            paste · drop · or click upload
          </span>
        </div>
      )}
    </div>
  )
}

const FLUID_SIZING = {
  outer: "flex w-full flex-col gap-[2cqw] overflow-hidden p-[2cqw]",
  uploadButton:
    "flex w-full items-center justify-center gap-[2cqw] rounded-[3cqw] px-[4cqw] py-[4.5cqw] text-[clamp(0.65rem,2.8cqw,1rem)] font-semibold transition-all",
  urlRow: "flex items-center gap-[1.5cqw]",
  urlLabel:
    "flex flex-1 items-center gap-[2cqw] rounded-[3cqw] bg-foreground/[0.06] px-[3cqw] py-[4.5cqw] transition-colors focus-within:bg-foreground/[0.1]",
  urlIconTint: "text-muted-foreground/60",
  urlInput:
    "min-w-0 flex-1 bg-transparent text-[clamp(0.65rem,2.8cqw,1rem)] text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
  captureButton:
    "flex w-full items-center justify-center gap-[2cqw] rounded-[3cqw] bg-foreground/[0.06] py-[4.5cqw] text-[clamp(0.65rem,2.8cqw,1rem)] font-medium text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground",
  captureDisabled:
    "cursor-default opacity-60 hover:bg-foreground/[0.06] hover:text-muted-foreground",
  icon: "size-[clamp(0.7rem,2.5cqw,1rem)]",
  settingsTrigger: "rounded-[3cqw] py-[4.5cqw] px-[4.5cqw]",
  settingsIcon: "size-[clamp(1rem,6cqw,2rem)]",
  hintBox:
    "-mx-[2cqw] mt-[0.5cqw] -mb-[2cqw] flex items-center justify-center border-t border-border/30 px-[3cqw] py-[2cqw]",
  hintText:
    "inline-flex items-center gap-[1.5cqw] text-[clamp(0.45rem,1.4cqw,0.7rem)] text-muted-foreground/50",
  hintKbd:
    "rounded border border-border/50 bg-foreground/[0.06] px-[1.2cqw] py-[0.3cqw] font-mono text-[clamp(0.4rem,1.2cqw,0.62rem)] text-muted-foreground",
} as const

const DEFAULT_SIZING = {
  outer: "flex flex-col gap-2 p-2.5 text-neutral-950 dark:text-white",
  uploadButton:
    "flex w-full items-center justify-center gap-2.5 rounded-lg px-5 py-4 text-[14px] font-semibold tracking-[-0.02em] transition-all",
  urlRow: "flex items-center gap-1.5",
  urlLabel:
    "flex min-h-10 flex-1 items-center gap-2 max-md:w-10 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-left transition-colors focus-within:border-neutral-300 focus-within:bg-white dark:border-white/10 dark:bg-white/8 dark:focus-within:bg-white/12",
  urlIconTint: "text-neutral-400 dark:text-white/35",
  urlInput:
    "min-w-0 flex-1 bg-transparent text-[16px] text-neutral-950 placeholder:text-neutral-400 focus:outline-none sm:text-[13px] dark:text-white dark:placeholder:text-white/35",
  captureButton:
    "flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 py-2.5 text-[13px] font-medium text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-800 dark:border-white/10 dark:bg-white/8 dark:text-white/45 dark:hover:bg-white/12 dark:hover:text-white/75",
  captureDisabled:
    "cursor-default opacity-60 hover:bg-neutral-50 hover:text-neutral-500 dark:hover:bg-white/8 dark:hover:text-white/45",
  icon: "size-4",
  settingsTrigger: "size-10 rounded-md",
  settingsIcon: "size-4",
  hintBox:
    "-mx-2.5 mt-0.5 -mb-2.5 flex items-center justify-center border-t border-neutral-200 px-4 py-2.5 dark:border-white/10",
  hintText:
    "inline-flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-white/40",
  hintKbd:
    "rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-white/10 dark:bg-white/10 dark:text-white/70",
} as const
