import type { Template, TemplateTab } from "./types"
import browserDark from "./browser-dark"
import galaxySandStage from "./galaxy-sand-stage"
import ipadShowcase from "./ipad-showcase"
import iphonePresentation from "./iphone-presentation"
import iphoneShowcase from "./iphone-showcase"
import iphoneSpotlight from "./iphone-spotlight"
import pastleUiShowcase from "./pastle-ui-showcase"
import productReveal from "./product-reveal"
import responsiveLayout from "./responsive-layout"
import screenshotGlow from "./screenshot-glow"
import silentReveal from "./silent-reveal"
import twinPhoneStage from "./twin-phone-stage"
import uiCloseupShowcase from "./ui-closeup-showcase"

export type { Template, TemplateCategory, TemplateTab } from "./types"

/**
 * The template catalogue. Each entry is authored from a real composition:
 * build it in the editor, hit the dev-only "Copy template" action (which copies
 * the JSON and publishes a poster to R2), drop the JSON into a `./<slug>.ts`
 * module, and register it here pointing `thumbnail` at the returned R2 URL.
 */
export const TEMPLATES: Template[] = [
  // Normal screenshots
  browserDark,
  screenshotGlow,
  silentReveal,
  // Animations
  productReveal,
  // iPad
  ipadShowcase,
  // Responsive / multi-device
  responsiveLayout,
  // All phones together
  iphoneShowcase,
  iphonePresentation,
  iphoneSpotlight,
  pastleUiShowcase,
  uiCloseupShowcase,
  twinPhoneStage,
  galaxySandStage,
]

const TAB_LABELS: Record<TemplateTab, string> = {
  all: "All",
  image: "Image",
  animation: "Animation",
}

export function templateTabLabel(tab: TemplateTab): string {
  return TAB_LABELS[tab]
}

export function templatesForTab(tab: TemplateTab): Template[] {
  if (tab === "all") return TEMPLATES
  return TEMPLATES.filter((t) => t.category === tab)
}

export function templateCountForTab(tab: TemplateTab): number {
  return templatesForTab(tab).length
}
