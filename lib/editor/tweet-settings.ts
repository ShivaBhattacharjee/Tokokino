import type { FontFamilyOption, TweetCard, TweetTheme } from "./state-types"
import { FONT_FAMILIES } from "./fonts"

export type TweetCardSettings = {
  theme: TweetTheme
  showMetrics: boolean
  showAvatar: boolean
  showImages: boolean
  showTimestamp: boolean
  fontFamily: string
}

export const DEFAULT_TWEET_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const DEFAULT_TWEET_SETTINGS: TweetCardSettings = {
  theme: "dark",
  showMetrics: true,
  showAvatar: true,
  showImages: true,
  showTimestamp: true,
  fontFamily: DEFAULT_TWEET_FONT_FAMILY,
}

export const TWEET_THEME_OPTIONS: {
  id: TweetTheme
  label: string
  swatch: string
}[] = [
  { id: "dark", label: "Dark", swatch: "#000000" },
  { id: "light", label: "Light", swatch: "#ffffff" },
  { id: "dim", label: "Dim", swatch: "#15202b" },
]

const TWEET_FONT_LABELS = [
  "Inter",
  "Geist",
  "Roboto",
  "Poppins",
  "Outfit",
  "Space Grotesk",
  "Nunito",
  "Playfair Display",
  "Lora",
  "Fira Code",
  "Geist Mono",
] as const

export const TWEET_FONT_OPTIONS: FontFamilyOption[] = [
  {
    id: "tweet-default",
    label: "X Default",
    css: DEFAULT_TWEET_FONT_FAMILY,
    category: "system",
  },
  ...TWEET_FONT_LABELS.map((label) =>
    FONT_FAMILIES.find((font) => font.label === label)
  ).filter((font): font is FontFamilyOption => Boolean(font)),
  ...FONT_FAMILIES.filter((font) => font.category === "system"),
]

export function tweetSettingsFromCard(tweet: TweetCard): TweetCardSettings {
  return {
    theme: tweet.theme,
    showMetrics: tweet.showMetrics,
    showAvatar: tweet.showAvatar,
    showImages: tweet.showImages ?? true,
    showTimestamp: tweet.showTimestamp ?? true,
    fontFamily: tweet.fontFamily ?? DEFAULT_TWEET_FONT_FAMILY,
  }
}
