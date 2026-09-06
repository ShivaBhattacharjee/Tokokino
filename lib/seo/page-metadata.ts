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
  image,
  publishedTime,
  modifiedTime,
  authors,
  keywords,
}: {
  title: string
  description: string
  path: string
  type?: "website" | "article"
  image?: { url: string; alt: string; width?: number; height?: number }
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  keywords?: string[]
}): Metadata {
  const ogImages = image
    ? [
        {
          url: image.url,
          alt: image.alt,
          ...(image.width ? { width: image.width } : {}),
          ...(image.height ? { height: image.height } : {}),
        },
      ]
    : [{ ...OG_IMAGE, type: "image/png" }]

  const twitterImages = image
    ? [{ url: image.url, alt: image.alt }]
    : [OG_IMAGE]

  const openGraph =
    type === "article"
      ? {
          title,
          description,
          url: path,
          type: "article" as const,
          siteName: "Tokokino",
          locale: "en_US",
          images: ogImages,
          ...(publishedTime ? { publishedTime } : {}),
          ...(modifiedTime ? { modifiedTime } : {}),
          ...(authors && authors.length > 0 ? { authors } : {}),
        }
      : {
          title,
          description,
          url: path,
          type: "website" as const,
          siteName: "Tokokino",
          locale: "en_US",
          images: ogImages,
        }

  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    ...(authors && authors.length > 0
      ? { authors: authors.map((name) => ({ name })) }
      : {}),
    alternates: { canonical: path },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: twitterImages,
    },
  }
}
