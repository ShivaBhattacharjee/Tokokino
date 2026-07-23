import type { Template, TemplateTab } from "./types"
import browserDark from "./browser-dark"
import ipadShowcase from "./ipad-showcase"
import iphonePresentation from "./iphone-presentation"
import iphoneShowcase from "./iphone-showcase"
import screenshotGlow from "./screenshot-glow"

export type { Template, TemplateCategory, TemplateTab } from "./types"

/**
 * The template catalogue. Each entry is authored from a real composition:
 * build it in the editor, hit the dev-only "Copy template" action (which copies
 * the JSON and publishes a poster to R2), drop the JSON into a `./<slug>.ts`
 * module, and register it here pointing `thumbnail` at the returned R2 URL.
 */
export const TEMPLATES: Template[] = [
  browserDark,
  screenshotGlow,
  iphoneShowcase,
  iphonePresentation,
  ipadShowcase,
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
