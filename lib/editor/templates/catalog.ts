/**
 * Single source of truth for template display metadata. The heavy composition
 * `state` for each template lives in the per-slug modules in this directory and
 * is merged onto its `templateMeta` entry (see `<slug>.ts`). Keeping metadata
 * here lets the landing marquee and /showcase page list templates without
 * importing every template's full editor state.
 */
export type TemplateCategory = "image" | "animation"

export type TemplateMeta = {
  /** Stable kebab-case slug; also the R2 asset basename (templates/<id>.*). */
  id: string
  name: string
  category: TemplateCategory
  /** Poster image on R2, e.g. "https://assets.tokokino.com/templates/<id>.jpg". */
  thumbnail: string
  /** Preview clip (R2) that plays on hover — animation templates only. */
  preview?: string
}

/** Ordered as templates appear in the editor's Templates dialog. */
export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: "browser-dark",
    name: "Browser, Dark",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/browser-dark.jpg",
  },
  {
    id: "screenshot-glow",
    name: "Screenshot, Glow",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/screenshot-glow.jpg",
  },
  {
    id: "silent-reveal",
    name: "Silent Reveal",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/silent-reveal.jpg",
  },
  {
    id: "product-reveal",
    name: "Product Reveal",
    category: "animation",
    thumbnail: "https://assets.tokokino.com/templates/product-reveal.jpg",
    preview: "https://assets.tokokino.com/templates/product-reveal.webm",
  },
  {
    id: "slide-reveal",
    name: "Slide Reveal",
    category: "animation",
    thumbnail: "https://assets.tokokino.com/templates/slide-reveal.jpg",
    preview: "https://assets.tokokino.com/templates/slide-reveal.webm",
  },
  {
    id: "slide-up-reveal",
    name: "Slide Up Reveal",
    category: "animation",
    thumbnail: "https://assets.tokokino.com/templates/slide-up-reveal.jpg",
    preview: "https://assets.tokokino.com/templates/slide-up-reveal.webm",
  },
  {
    id: "ipad-showcase",
    name: "iPad Pro, UI Showcase",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/ipad-showcase.jpg",
  },
  {
    id: "responsive-layout",
    name: "Responsive Layout",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/responsive-layout.jpg",
  },
  {
    id: "iphone-showcase",
    name: "iPhone, UI Showcase",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/iphone-showcase.jpg",
  },
  {
    id: "iphone-presentation",
    name: "iPhone, App Presentation",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/iphone-presentation.jpg",
  },
  {
    id: "iphone-spotlight",
    name: "iPhone, Spotlight",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/iphone-spotlight.jpg",
  },
  {
    id: "pastle-ui-showcase",
    name: "Pastel UI Showcase",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/pastel-ui-showcase.jpg",
  },
  {
    id: "ui-closeup-showcase",
    name: "UI Closeup Showcase",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/ui-closeup-showcase.jpg",
  },
  {
    id: "twin-phones-stage",
    name: "Twin Phones, Stage",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/twin-phones-stage.jpg",
  },
  {
    id: "galaxy-sand-stage",
    name: "Galaxy, Sand Stage",
    category: "image",
    thumbnail: "https://assets.tokokino.com/templates/galaxy-sand-stage.jpg",
  },
]

export const templateMeta: Record<string, TemplateMeta> = Object.fromEntries(
  TEMPLATE_CATALOG.map((meta) => [meta.id, meta])
)

/** Deep-link that opens a template straight in the editor. */
export function templateEditorHref(id: string) {
  return `/app?template=${id}`
}
