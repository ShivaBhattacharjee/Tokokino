const SITE_URL = "https://tokokino.com"

export const tokokinoStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Tokokino",
      description:
        "Tokokino is an independent open-source project for creating polished product screenshots and animated demos in the browser.",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: "hello@theshiva.xyz",
      founder: {
        "@type": "Person",
        name: "Shiva Bhattacharjee",
        url: "https://github.com/ShivaBhattacharjee",
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@theshiva.xyz",
        contactType: "customer support",
        availableLanguage: "English",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Guwahati",
        addressRegion: "Assam",
        addressCountry: "IN",
      },
      sameAs: [
        "https://github.com/ShivaBhattacharjee/tokokino",
        "https://x.com/sh17va",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software-application`,
      name: "Tokokino",
      description:
        "A browser-based design editor for polished screenshots, device mockups, annotations, social graphics, and animated product demos.",
      url: `${SITE_URL}/app`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any modern web browser",
      browserRequirements:
        "Requires JavaScript and a modern browser for the interactive editor.",
      isAccessibleForFree: true,
      image: `${SITE_URL}/opengraph.png`,
      featureList: [
        "Screenshot styling and backgrounds",
        "Device frames and multi-screenshot layouts",
        "Annotations and text overlays",
        "Timeline animation",
        "PNG, GIF, and WebM export",
        "Shareable project links",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
  ],
} as const

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
