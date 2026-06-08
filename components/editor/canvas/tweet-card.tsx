"use client"

import * as React from "react"
import {
  RiBlueskyFill,
  RiDeleteBinLine,
  RiPencilLine,
  RiTwitterXLine,
} from "@remixicon/react"
import unescape from "lodash/unescape"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  UploadCard,
  type CaptureDevice,
  type CaptureSettings,
} from "@/components/editor/canvas/upload-card"
import { InnerLightingOverlay } from "@/components/editor/canvas/inner-lighting-overlay"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import type {
  EditorTool,
  ScreenshotLayer,
  TweetCard,
  TweetData,
  TweetLinkPreview,
  TweetMedia,
  TweetTheme,
} from "@/lib/editor/store"
import {
  DEFAULT_TWEET_FONT_FAMILY,
  DEFAULT_TWEET_FONT_SIZE,
} from "@/lib/editor/tweet-settings"
import { cn } from "@/lib/utils"

type ThemePalette = {
  bg: string
  text: string
  sub: string
  border: string
  link: string
}

const THEMES: Record<TweetTheme, ThemePalette> = {
  light: {
    bg: "#ffffff",
    text: "#0f1419",
    sub: "#536471",
    border: "#cfd9de",
    link: "#1d9bf0",
  },
  dim: {
    bg: "#15202b",
    text: "#f7f9f9",
    sub: "#8b98a5",
    border: "#38444d",
    link: "#1d9bf0",
  },
  dark: {
    bg: "#000000",
    text: "#e7e9ea",
    sub: "#71767b",
    border: "#2f3336",
    link: "#1d9bf0",
  },
}

const VERIFIED_PATH =
  "M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.689.878.635.132 1.294.084 1.902-.14.27.586.7 1.084 1.24 1.439.541.354 1.168.551 1.814.569.647-.016 1.276-.213 1.817-.567s.972-.853 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"

function VerifiedBadge({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      aria-label="Verified account"
      className="ml-0.5 inline-block size-[1.05em] shrink-0 translate-y-[0.08em]"
      fill={color}
    >
      <path d={VERIFIED_PATH} />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05em] shrink-0"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  )
}

function LikeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05em] shrink-0"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function RepostIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05em] shrink-0"
      aria-hidden
    >
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ViewsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05em] shrink-0"
      aria-hidden
    >
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-8" />
      <path d="M22 19V7" />
    </svg>
  )
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0"
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k.toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  }
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
}

function formatDate(raw: string): string {
  if (!raw) return ""
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${time} · ${date}`
}

/**
 * X serves tweet text HTML-escaped (`>` → `&gt;`, `<` → `&lt;`, `&` → `&amp;`),
 * so reverse the entities X emits (`&amp; &lt; &gt; &quot; &#39;`) via lodash's
 * unescape. Bluesky returns raw text, so it is left untouched. Decoding here
 * (rather than at fetch time) also fixes posts already saved with the escaped
 * entities in persisted editor state.
 */
function displayText(text: string, source: TweetData["source"]): string {
  return source === "bluesky" ? text : unescape(text)
}

const ENTITY_RE =
  /(https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?|@\w{1,15}|#[\p{L}\p{N}_]+)/giu

function isEntity(token: string): boolean {
  return /^(https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}|@\w|#[\p{L}\p{N}_])/iu.test(
    token
  )
}

/** Renders tweet text with URLs, @mentions and #hashtags tinted in link color. */
function renderTweetText(text: string, link: string): React.ReactNode {
  return text.split(ENTITY_RE).map((token, i) => {
    if (!token) return null
    if (isEntity(token)) {
      return (
        <span key={i} style={{ color: link }}>
          {token}
        </span>
      )
    }
    return <React.Fragment key={i}>{token}</React.Fragment>
  })
}

function mediaGridClass(count: number) {
  if (count === 1) return "grid-cols-1"
  if (count >= 3) return "grid-cols-2 grid-rows-2 aspect-[1.5/1]"
  return "grid-cols-2"
}

function mediaItemClass(count: number, index: number) {
  if (count === 1) return ""
  if (count === 2) return "aspect-[1.42/1]"
  if (count === 3 && index === 0) return "row-span-2"
  return ""
}

function mediaAspect(media: TweetMedia): string | undefined {
  if (!media.width || !media.height) return undefined
  if (!Number.isFinite(media.width) || !Number.isFinite(media.height)) {
    return undefined
  }
  if (media.width <= 0 || media.height <= 0) return undefined
  return `${media.width} / ${media.height}`
}

// A single image keeps its natural aspect ratio, clamped to a sane range so a
// portrait shot doesn't blow up into a giant box and an ultra-wide shot doesn't
// shrink to a sliver. Combined with full width + object-cover this means no side
// whitespace, with only minimal cropping at the extremes (like X / PostSpark).
const SINGLE_MEDIA_MIN_ASPECT = 0.8 // tallest portrait, ~4:5
const SINGLE_MEDIA_MAX_ASPECT = 16 / 9 // widest landscape

function singleMediaAspect(media: TweetMedia): number {
  const { width, height } = media
  if (
    !width ||
    !height ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return SINGLE_MEDIA_MAX_ASPECT
  }
  return Math.min(
    SINGLE_MEDIA_MAX_ASPECT,
    Math.max(SINGLE_MEDIA_MIN_ASPECT, width / height)
  )
}

type TweetMediaGridProps = {
  id: string
  media: NonNullable<TweetData["media"]>
  palette: ThemePalette
  compact?: boolean
}

function TweetMediaGrid({
  id,
  media,
  palette,
  compact = false,
}: TweetMediaGridProps) {
  // A single image fills the full width of the card (like X / Bluesky) and
  // crops with object-cover, so there is never any side whitespace. The box
  // takes the image's (clamped) aspect ratio, and the card's own fit-scaling
  // keeps a tall portrait box from overflowing the canvas.
  if (media.length === 1) {
    const item = media[0]
    return (
      <div
        className={cn(
          compact ? "mt-3 rounded-[14px]" : "mt-3 rounded-[18px]",
          "overflow-hidden border"
        )}
        style={{
          borderColor: palette.border,
          background: palette.bg,
          aspectRatio: singleMediaAspect(item),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.alt ?? ""}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        compact ? "mt-3 gap-1.5 rounded-[14px]" : "mt-3 gap-2 rounded-[18px]",
        "grid overflow-hidden border",
        mediaGridClass(media.length)
      )}
      style={{
        borderColor: palette.border,
        background: palette.bg,
      }}
    >
      {media.map((item, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${id}-${item.url}`}
          src={item.url}
          alt={item.alt ?? ""}
          draggable={false}
          className={cn(
            "h-full min-h-0 w-full object-cover",
            mediaItemClass(media.length, index)
          )}
        />
      ))}
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1em] shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20" />
      <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  )
}

type LinkPreviewCardProps = {
  preview: TweetLinkPreview
  palette: ThemePalette
  showImage: boolean
  compact?: boolean
}

function LinkPreviewCard({
  preview,
  palette,
  showImage,
  compact = false,
}: LinkPreviewCardProps) {
  const image = showImage ? preview.image : undefined

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden border",
        compact ? "rounded-[14px]" : "rounded-[18px]"
      )}
      style={{ borderColor: palette.border }}
    >
      {image ? (
        <div
          className="overflow-hidden border-b"
          style={{
            borderColor: palette.border,
            aspectRatio: mediaAspect(image) ?? "1.91 / 1",
            maxHeight: compact ? "24cqh" : "42cqh",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt ?? preview.title}
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className={compact ? "p-3" : "p-4"}>
        <div
          className={cn(
            "line-clamp-2 leading-tight font-bold",
            compact ? "text-[0.8em]" : "text-[0.9em]"
          )}
          style={{ color: palette.text }}
        >
          {preview.title}
        </div>
        {preview.description ? (
          <div
            className={cn(
              "mt-1 line-clamp-2 leading-snug",
              compact ? "text-[0.7em]" : "text-[0.8em]"
            )}
            style={{ color: palette.text }}
          >
            {preview.description}
          </div>
        ) : null}
        {preview.domain ? (
          <div
            className={cn(
              "mt-3 flex items-center gap-1.5 truncate border-t pt-3",
              compact ? "text-[0.65em]" : "text-[0.75em]"
            )}
            style={{ color: palette.sub, borderColor: palette.border }}
          >
            <GlobeIcon />
            <span className="truncate">{preview.domain}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type QuoteTweetPreviewProps = {
  tweet: TweetData
  palette: ThemePalette
  showAvatar: boolean
  showImages: boolean
}

function QuoteTweetPreview({
  tweet,
  palette,
  showAvatar,
  showImages,
}: QuoteTweetPreviewProps) {
  const media = showImages ? (tweet.media ?? []).slice(0, 4) : []
  const linkPreview = tweet.linkPreview

  return (
    <div
      className="mt-3 overflow-hidden rounded-[18px] border p-3"
      style={{ borderColor: palette.border }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showAvatar ? (
          tweet.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${tweet.id}-quote-avatar-${tweet.author.avatarUrl}`}
              src={tweet.author.avatarUrl}
              alt={tweet.author.name}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="size-8 shrink-0 rounded-full"
              style={{ background: palette.border }}
            />
          )
        ) : null}
        <div className="flex min-w-0 items-baseline gap-1.5 text-[0.8em] leading-tight">
          <span className="truncate font-bold" style={{ color: palette.text }}>
            {tweet.author.name}
          </span>
          {tweet.author.verified ? (
            <VerifiedBadge color={palette.link} />
          ) : null}
          {tweet.author.handle ? (
            <span className="truncate" style={{ color: palette.sub }}>
              @{tweet.author.handle}
            </span>
          ) : null}
        </div>
      </div>

      {tweet.text ? (
        <p className="mt-2 text-[0.9em] leading-normal break-words whitespace-pre-wrap">
          {renderTweetText(displayText(tweet.text, tweet.source), palette.link)}
        </p>
      ) : null}

      {media.length > 0 ? (
        <TweetMediaGrid
          id={`${tweet.id}-quote`}
          media={media}
          palette={palette}
          compact
        />
      ) : null}

      {linkPreview ? (
        <LinkPreviewCard
          preview={linkPreview}
          palette={palette}
          showImage={showImages}
          compact
        />
      ) : null}
    </div>
  )
}

type TweetCardViewProps = {
  tweet: TweetCard
  transform: string
  borderRadius: number
  boxShadow?: string
  enhanceFilter?: string
  screenshotLayer: ScreenshotLayer
  innerLightingStyle?: React.CSSProperties | null
  leftPct: number
  topPct: number
  isSelected?: boolean
  isDragging?: boolean
  activeTool?: EditorTool
  onSelect?: (e: React.MouseEvent<HTMLDivElement>) => void
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onReplace?: (url: string, settings?: TweetCardSettings) => Promise<void>
  onReplaceFile?: (file: File) => void
  onCaptureWebsite?: (
    url: string,
    settings: CaptureSettings
  ) => void | Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
  onDelete?: () => void
}

export function TweetCardView({
  tweet,
  transform,
  borderRadius,
  boxShadow,
  enhanceFilter,
  screenshotLayer,
  innerLightingStyle,
  leftPct,
  topPct,
  isSelected = false,
  isDragging = false,
  activeTool = "pointer",
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onReplace,
  onReplaceFile,
  onCaptureWebsite,
  captureDefaultDevice,
  captureStateKey,
  onDelete,
}: TweetCardViewProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [fitScale, setFitScale] = React.useState(1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const { data, theme, showMetrics, showAvatar } = tweet
  const source = data.source ?? "x"
  const t = THEMES[theme] ?? THEMES.dark
  const showImages = tweet.showImages ?? true
  const media = showImages ? (data.media ?? []).slice(0, 4) : []
  const showTimestamp = tweet.showTimestamp ?? true

  const updateFitScale = React.useCallback(() => {
    const container = containerRef.current
    const card = cardRef.current
    if (!container || !card) return

    const maxWidth = container.clientWidth * 0.96
    const maxHeight = container.clientHeight * 0.96
    const cardWidth = card.offsetWidth
    const cardHeight = card.scrollHeight
    if (maxWidth <= 0 || maxHeight <= 0 || cardWidth <= 0 || cardHeight <= 0) {
      return
    }

    const nextScale = Math.max(
      0.28,
      Math.min(1, maxWidth / cardWidth, maxHeight / cardHeight)
    )
    setFitScale((current) =>
      Math.abs(current - nextScale) > 0.01 ? nextScale : current
    )
  }, [])

  React.useLayoutEffect(() => {
    updateFitScale()
    const container = containerRef.current
    const card = cardRef.current
    if (!container || !card) return

    const observer = new ResizeObserver(updateFitScale)
    observer.observe(container)
    observer.observe(card)

    void document.fonts?.ready.then(updateFitScale)

    return () => observer.disconnect()
  }, [
    data,
    showAvatar,
    showMetrics,
    showTimestamp,
    media.length,
    updateFitScale,
  ])

  const cardStyle: React.CSSProperties = {
    background: t.bg,
    color: t.text,
    border: `1px solid ${t.border}`,
    borderRadius,
    boxShadow,
    transform,
    transformStyle: "preserve-3d",
    filter: enhanceFilter || undefined,
    opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
    width: "min(98cqw, 996px)",
    fontFamily: tweet.fontFamily ?? DEFAULT_TWEET_FONT_FAMILY,
    fontSize: `var(--tweet-font-size-preview, ${tweet.fontSize ?? DEFAULT_TWEET_FONT_SIZE}px)`,
  }
  if (screenshotLayer.blendMode && screenshotLayer.blendMode !== "normal") {
    cardStyle.mixBlendMode = screenshotLayer.blendMode
  }

  const date = formatDate(data.createdAt)

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      style={{ containerType: "size" }}
    >
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            onReplaceFile?.(file)
            setEditOpen(false)
          }
          e.target.value = ""
        }}
      />
      <div
        ref={cardRef}
        data-editor-shadow-box-target
        data-tweet-card
        data-selection-border={isSelected ? "true" : undefined}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "group/tweet pointer-events-auto absolute overflow-hidden p-4",
          onPointerDown
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-default"
        )}
        style={{
          ...cardStyle,
          left: `var(--editor-main-position-x, ${leftPct}%)`,
          top: `var(--editor-main-position-y, ${topPct}%)`,
          transform: `translate(-50%, -50%) ${transform} scale(${fitScale})`,
          transformOrigin: "center",
        }}
      >
        <div className="flex items-start gap-3">
          {showAvatar ? (
            data.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${data.id}-avatar-${data.author.avatarUrl}`}
                src={data.author.avatarUrl}
                alt={data.author.name}
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="size-14 shrink-0 rounded-full"
                style={{ background: t.border }}
              />
            )
          ) : null}
          <div className="min-w-0 flex-1 leading-tight">
            <div
              className="flex items-center text-[1em] font-bold"
              style={{ color: t.text }}
            >
              <span className="truncate">{data.author.name}</span>
              {data.author.verified ? <VerifiedBadge color={t.link} /> : null}
            </div>
            {data.author.handle ? (
              <div className="truncate text-[0.9em]" style={{ color: t.sub }}>
                @{data.author.handle}
              </div>
            ) : null}
          </div>
          {source === "bluesky" ? (
            <RiBlueskyFill
              className="size-[28px] shrink-0"
              style={{ color: t.text }}
            />
          ) : (
            <RiTwitterXLine
              className="size-[28px] shrink-0"
              style={{ color: t.text }}
            />
          )}
        </div>

        {data.text ? (
          <p className="mt-3 text-[1em] leading-normal break-words whitespace-pre-wrap">
            {renderTweetText(displayText(data.text, source), t.link)}
          </p>
        ) : null}

        {media.length > 0 ? (
          <TweetMediaGrid id={data.id} media={media} palette={t} />
        ) : null}

        {data.linkPreview ? (
          <LinkPreviewCard
            preview={data.linkPreview}
            palette={t}
            showImage={showImages}
          />
        ) : null}

        {data.quotedTweet && (tweet.showQuote ?? true) ? (
          <QuoteTweetPreview
            tweet={data.quotedTweet}
            palette={t}
            showAvatar={showAvatar}
            showImages={showImages}
          />
        ) : null}

        {showMetrics || (showTimestamp && date) ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9em]"
            style={{ color: t.sub }}
          >
            {showMetrics ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <ReplyIcon />
                  {formatCount(data.metrics.replies)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RepostIcon />
                  {formatCount(data.metrics.reposts)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LikeIcon />
                  {formatCount(data.metrics.likes)}
                </span>
                {data.metrics.views !== undefined ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ViewsIcon />
                    {formatCount(data.metrics.views)}
                  </span>
                ) : null}
              </>
            ) : null}
            {showTimestamp && date ? (
              <span className="text-[0.8em]">{date}</span>
            ) : null}
          </div>
        ) : null}

        <InnerLightingOverlay
          style={innerLightingStyle}
          className="rounded-[inherit]"
        />

        {activeTool === "pointer" && !screenshotLayer.hidden ? (
          <div
            data-export-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200",
              editOpen || isSelected
                ? "opacity-100"
                : "opacity-0 group-hover/tweet:opacity-100",
              isDragging && !editOpen && "opacity-0!"
            )}
          >
            <Popover open={editOpen} onOpenChange={setEditOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Edit post"
                  title="Edit post"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditOpen((open) => !open)
                  }}
                  className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background text-foreground shadow-xl ring-2 ring-foreground/15 transition-[ring-color] hover:ring-foreground/30 sm:size-14"
                >
                  <RiPencilLine className="size-5 sm:size-7" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                data-export-hidden="true"
                align="center"
                side="bottom"
                sideOffset={10}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="w-[320px] gap-0 rounded-2xl border border-border bg-popover p-0 shadow-2xl"
              >
                <div className="overflow-hidden rounded-2xl">
                  <UploadCard
                    onBrowse={() => replaceInputRef.current?.click()}
                    onCapture={onCaptureWebsite}
                    onLoadTweet={
                      onReplace
                        ? async (url, settings) => {
                            await onReplace(url, settings)
                          }
                        : undefined
                    }
                    defaultDevice={captureDefaultDevice}
                    captureStateKey={captureStateKey}
                  />
                  {onDelete ? (
                    <div className="border-t border-border/60 p-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditOpen(false)
                          onDelete()
                        }}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 text-[13px] font-medium text-destructive transition-all hover:bg-destructive/18 hover:text-destructive"
                      >
                        <RiDeleteBinLine className="size-4" />
                        Remove post
                      </button>
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
    </div>
  )
}
