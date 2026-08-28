import type { Metadata } from "next"

const OG_IMAGE = {
  url: "/opengraph.png?v=2",
  width: 1920,
  height: 1008,
  alt: "Tokokino screenshot and animated demo editor preview",
} as const

/**
 * Next merges metadata shallowly, so a page that sets `openGraph` replaces the
 * root object outright — including its images. Anything overriding the social
 * card has to restate every field it still wants.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string
  description: string
  path: string
  type?: "website" | "article"
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type,
      siteName: "Tokokino",
      locale: "en_US",
      images: [{ ...OG_IMAGE, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  }
}
