import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react"

import { ShimmerImage } from "@/components/ui/shimmer-image"

const CHROME_WIDTH = 1202
const CHROME_HEIGHT = 776
const SCREEN_X = 1
const SCREEN_Y = 76
const SCREEN_WIDTH = 1200
const SCREEN_HEIGHT = 700

const LEFT_PCT = (SCREEN_X / CHROME_WIDTH) * 100
const TOP_PCT = (SCREEN_Y / CHROME_HEIGHT) * 100
const WIDTH_PCT = (SCREEN_WIDTH / CHROME_WIDTH) * 100
const HEIGHT_PCT = (SCREEN_HEIGHT / CHROME_HEIGHT) * 100
const ADDRESS_LEFT_PCT = (172 / CHROME_WIDTH) * 100
const ADDRESS_TOP_PCT = (39 / CHROME_HEIGHT) * 100
const ADDRESS_WIDTH_PCT = (820 / CHROME_WIDTH) * 100
const ADDRESS_HEIGHT_PCT = (32 / CHROME_HEIGHT) * 100

type ChromeColorMode = "light" | "dark"
type ImageFit = "contain" | "cover" | "fill"

export interface ChromeProps extends HTMLAttributes<HTMLDivElement> {
  url?: string
  imageSrc?: string
  videoSrc?: string
  colorMode?: ChromeColorMode
  children?: ReactNode
  screenRef?: Ref<HTMLDivElement>
  imageRef?: Ref<HTMLImageElement>
  onImageLoad?: (e: SyntheticEvent<HTMLImageElement>) => void
  imageFit?: ImageFit
  frameBorderRadius?: string | number
  screenBorderRadius?: string | number
  addressValue?: string
  addressPlaceholder?: string
  onAddressChange?: (value: string) => void
  shimmer?: boolean
}

export function Chrome({
  imageSrc,
  videoSrc,
  url,
  colorMode,
  children,
  screenRef,
  imageRef,
  onImageLoad,
  imageFit = "cover",
  frameBorderRadius = "8px",
  screenBorderRadius = "0 0 8px 8px",
  addressValue,
  addressPlaceholder = "Search Google or type a URL",
  onAddressChange,
  shimmer = true,
  className,
  style,
  ...props
}: ChromeProps) {
  const hasVideo = !!videoSrc
  const addressText = addressValue ?? url ?? ""
  const tabTitle = chromeTabTitle(addressText)
  const editableAddress = !!onAddressChange

  const frameClasses =
    colorMode === "dark"
      ? "border-[#27272a] bg-[#202124] text-[#e8eaed]"
      : colorMode === "light"
        ? "border-[#d9dce1] bg-[#dee1e6] text-[#202124]"
        : "border-[#d9dce1] bg-[#dee1e6] text-[#202124] dark:border-[#27272a] dark:bg-[#202124] dark:text-[#e8eaed]"
  const tabBarClasses =
    colorMode === "dark"
      ? "bg-[#202124]"
      : colorMode === "light"
        ? "bg-[#dee1e6]"
        : "bg-[#dee1e6] dark:bg-[#202124]"
  const toolbarClasses =
    colorMode === "dark"
      ? "border-[#2b2c30] bg-[#292a2d]"
      : colorMode === "light"
        ? "border-[#d2d5da] bg-[#f1f3f4]"
        : "border-[#d2d5da] bg-[#f1f3f4] dark:border-[#2b2c30] dark:bg-[#292a2d]"
  const addressClasses =
    colorMode === "dark"
      ? "bg-[#202124] text-[#bdc1c6] ring-white/5"
      : colorMode === "light"
        ? "bg-white text-[#5f6368] ring-black/5"
        : "bg-white text-[#5f6368] ring-black/5 dark:bg-[#202124] dark:text-[#bdc1c6] dark:ring-white/5"
  const activeTabClasses =
    colorMode === "dark"
      ? "bg-[#292a2d] text-[#e8eaed]"
      : colorMode === "light"
        ? "bg-[#f1f3f4] text-[#202124]"
        : "bg-[#f1f3f4] text-[#202124] dark:bg-[#292a2d] dark:text-[#e8eaed]"
  const mutedIconClasses =
    colorMode === "dark"
      ? "text-[#9aa0a6]"
      : colorMode === "light"
        ? "text-[#5f6368]"
        : "text-[#5f6368] dark:text-[#9aa0a6]"
  const frameStyle: CSSProperties =
    colorMode === "dark"
      ? {
          backgroundColor: "#202124",
          borderColor: "#27272a",
          color: "#e8eaed",
        }
      : colorMode === "light"
        ? {
            backgroundColor: "#dee1e6",
            borderColor: "#d9dce1",
            color: "#202124",
          }
        : {}
  const tabBarStyle: CSSProperties =
    colorMode === "dark"
      ? { backgroundColor: "#202124" }
      : colorMode === "light"
        ? { backgroundColor: "#dee1e6" }
        : {}
  const toolbarStyle: CSSProperties =
    colorMode === "dark"
      ? { backgroundColor: "#292a2d", borderColor: "#2b2c30" }
      : colorMode === "light"
        ? { backgroundColor: "#f1f3f4", borderColor: "#d2d5da" }
        : {}
  const addressStyle: CSSProperties =
    colorMode === "dark"
      ? {
          backgroundColor: "#202124",
          color: "#bdc1c6",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
        }
      : colorMode === "light"
        ? {
            backgroundColor: "#ffffff",
            color: "#5f6368",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
          }
        : {}
  const activeTabStyle: CSSProperties =
    colorMode === "dark"
      ? { backgroundColor: "#292a2d", color: "#e8eaed" }
      : colorMode === "light"
        ? { backgroundColor: "#f1f3f4", color: "#202124" }
        : {}
  const mutedIconStyle: CSSProperties =
    colorMode === "dark"
      ? { color: "#9aa0a6" }
      : colorMode === "light"
        ? { color: "#5f6368" }
        : {}
  const dividerStyle: CSSProperties =
    colorMode === "dark"
      ? { backgroundColor: "rgba(255,255,255,0.1)" }
      : colorMode === "light"
        ? { backgroundColor: "rgba(0,0,0,0.1)" }
        : {}

  const screen = hasVideo ? (
    <video
      className="block size-full object-cover"
      src={videoSrc}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
    />
  ) : imageSrc ? (
    <ShimmerImage
      ref={imageRef}
      shimmer={shimmer}
      src={imageSrc}
      alt=""
      onLoad={onImageLoad}
      className={`block size-full ${imageFitClassName(imageFit)}`}
    />
  ) : (
    children
  )

  const screenBg =
    imageFit === "contain"
      ? colorMode === "dark"
        ? "bg-[#292a2d]"
        : colorMode === "light"
          ? "bg-[#f1f3f4]"
          : "bg-[#f1f3f4] dark:bg-[#292a2d]"
      : "bg-white dark:bg-[#292a2d]"
  const screenStyle: CSSProperties =
    imageFit === "contain"
      ? colorMode === "dark"
        ? { backgroundColor: "#292a2d" }
        : colorMode === "light"
          ? { backgroundColor: "#f1f3f4" }
          : {}
      : colorMode
        ? { backgroundColor: colorMode === "dark" ? "#292a2d" : "#ffffff" }
        : {}

  return (
    <div
      className={`relative inline-block w-full overflow-hidden border align-middle leading-none ${frameClasses} ${className ?? ""}`}
      style={{
        aspectRatio: `${CHROME_WIDTH}/${CHROME_HEIGHT}`,
        borderRadius: frameBorderRadius,
        containerType: "inline-size",
        ...frameStyle,
        ...style,
      }}
      {...props}
    >
      <div
        ref={hasVideo ? undefined : screenRef}
        className={`absolute z-0 overflow-hidden ${screenBg}`}
        style={{
          left: `${LEFT_PCT}%`,
          top: `${TOP_PCT}%`,
          width: `${WIDTH_PCT}%`,
          height: `${HEIGHT_PCT}%`,
          borderRadius: screenBorderRadius,
          ...screenStyle,
        }}
      >
        {screen}
      </div>

      <div
        className={`absolute inset-x-0 top-0 z-10 h-[4.381443%] ${tabBarClasses}`}
        style={tabBarStyle}
      >
        <div className="absolute top-1/2 left-[1.746%] flex -translate-y-1/2 items-center gap-[0.665cqw]">
          <span className="size-[0.998cqw] rounded-full bg-[#ff5f57]" />
          <span className="size-[0.998cqw] rounded-full bg-[#febc2e]" />
          <span className="size-[0.998cqw] rounded-full bg-[#28c840]" />
        </div>
        <div
          className={`absolute bottom-0 left-[8.153078%] flex h-[82%] w-[19.467554%] items-center gap-[0.55cqw] rounded-t-[0.8cqw] px-[1.15cqw] text-[1cqw] ${activeTabClasses}`}
          style={activeTabStyle}
        >
          <span className="truncate opacity-90">{tabTitle}</span>
          <span className="ml-auto text-[1.05em] opacity-50">x</span>
        </div>
        <div
          className={`absolute top-1/2 left-[29.034942%] h-[45%] w-px -translate-y-1/2 ${colorMode === "dark" ? "bg-white/10" : colorMode === "light" ? "bg-black/10" : "bg-black/10 dark:bg-white/10"}`}
          style={dividerStyle}
        />
        <div
          className={`absolute top-1/2 left-[29.866889%] -translate-y-1/2 text-[1.35cqw] ${mutedIconClasses}`}
          style={mutedIconStyle}
        >
          +
        </div>
      </div>

      <div
        className={`absolute inset-x-0 top-[4.381443%] z-20 h-[5.412371%] border-y ${toolbarClasses}`}
        style={toolbarStyle}
      >
        <div
          className={`absolute top-1/2 left-[1.497504%] flex -translate-y-1/2 items-center gap-[1cqw] ${mutedIconClasses}`}
          style={mutedIconStyle}
        >
          <ChromeArrow direction="left" />
          <ChromeArrow direction="right" />
          <ChromeRefresh />
        </div>

        <div
          className={`absolute flex -translate-y-1/2 items-center gap-[0.72cqw] rounded-full px-[1.15cqw] text-[1.2cqw] ring-1 ${addressClasses}`}
          style={{
            left: `${ADDRESS_LEFT_PCT}%`,
            top: "50%",
            width: `${ADDRESS_WIDTH_PCT}%`,
            height: `${(32 / 42) * 100}%`,
            ...addressStyle,
          }}
        >
          <ChromeLock />
          <span className="min-w-0 flex-1 truncate">
            {editableAddress ? "" : addressText}
          </span>
        </div>

        <div
          className={`absolute top-1/2 right-[1.663894%] flex -translate-y-1/2 items-center gap-[1cqw] ${mutedIconClasses}`}
          style={mutedIconStyle}
        >
          <ChromeStar />
          <ChromeMore />
        </div>
      </div>

      {editableAddress ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <label
          aria-label="Chrome address"
          className="absolute z-30 flex items-center overflow-hidden px-[3.45cqw]"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${ADDRESS_LEFT_PCT}%`,
            top: `${ADDRESS_TOP_PCT}%`,
            width: `${ADDRESS_WIDTH_PCT}%`,
            height: `${ADDRESS_HEIGHT_PCT}%`,
          }}
        >
          <input
            type="text"
            inputMode="url"
            value={addressText}
            placeholder={addressPlaceholder}
            spellCheck={false}
            onChange={(e) => onAddressChange?.(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent font-sans text-[1.2cqw] outline-none placeholder:text-current placeholder:opacity-65"
          />
        </label>
      ) : null}
    </div>
  )
}

function imageFitClassName(imageFit: ImageFit) {
  if (imageFit === "contain") return "object-contain object-center"
  if (imageFit === "fill") return "object-fill"
  return "object-cover object-top"
}

function ChromeArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[1.2cqw]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path
        d={
          direction === "left"
            ? "M9.8 3.5 5.3 8l4.5 4.5"
            : "M6.2 3.5 10.7 8l-4.5 4.5"
        }
      />
    </svg>
  )
}

function chromeTabTitle(address: string) {
  const value = address.trim()
  if (!value) return "New Tab"

  const withoutProtocol = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  const hostOrText = withoutProtocol.split(/[/?#]/, 1)[0] ?? ""
  const withoutAuth = hostOrText.split("@").pop() ?? hostOrText
  const withoutPort = withoutAuth.replace(/:\d+$/, "")
  const withoutWww = withoutPort.replace(/^www\./i, "")
  const firstPart = withoutWww.split(".").find(Boolean)

  return capitalizeTabTitle(firstPart || value)
}

function capitalizeTabTitle(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function ChromeRefresh() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[1.15cqw]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <path d="M12.2 5.2A5 5 0 1 0 13 8" />
      <path d="M12.4 2.7v2.8H9.6" />
    </svg>
  )
}

function ChromeLock() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[1.12cqw] shrink-0 opacity-75"
      fill="currentColor"
    >
      <path d="M5 7V5.6C5 3.7 6.2 2.5 8 2.5s3 1.2 3 3.1V7h.3c.8 0 1.2.4 1.2 1.2v3.9c0 .8-.4 1.2-1.2 1.2H4.7c-.8 0-1.2-.4-1.2-1.2V8.2C3.5 7.4 3.9 7 4.7 7H5Zm1.2 0h3.6V5.6c0-1.2-.7-1.9-1.8-1.9s-1.8.7-1.8 1.9V7Z" />
    </svg>
  )
}

function ChromeStar() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[1.15cqw]"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    >
      <path d="m8 2.4 1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 10.6l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L8 2.4Z" />
    </svg>
  )
}

function ChromeMore() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-[1.15cqw]"
      fill="currentColor"
    >
      <circle cx="8" cy="3.6" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="8" cy="12.4" r="1.1" />
    </svg>
  )
}
