const SITE_URL = "https://tokokino.com"
const PAGE_URL = `${SITE_URL}/about`

type Principle = {
  title: string
  body: string
}

export function aboutStructuredData({
  principles,
}: {
  principles: readonly Principle[]
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${PAGE_URL}/#about`,
        name: "About Tokokino",
        description:
          "Why Tokokino exists, how its local-first editor draws the line between the browser and the server, and how the open-source project is maintained.",
        url: PAGE_URL,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#software-application` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#maintainer`,
        name: "Shiva Bhattacharjee",
        url: "https://github.com/ShivaBhattacharjee",
        jobTitle: "Maintainer",
        homeLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Guwahati",
            addressRegion: "Assam",
            addressCountry: "IN",
          },
        },
        sameAs: [
          "https://github.com/ShivaBhattacharjee",
          "https://x.com/sh17va",
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${PAGE_URL}/#principles`,
        name: "How Tokokino is built",
        url: PAGE_URL,
        numberOfItems: principles.length,
        itemListElement: principles.map((principle, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: principle.title,
          description: principle.body,
        })),
      },
    ],
  }
}
