const SITE_URL = "https://tokokino.com"

export function GET() {
  const catalog = {
    linkset: [
      {
        anchor: `${SITE_URL}/api/share`,
        "service-doc": [{ href: `${SITE_URL}/llms.txt`, type: "text/plain" }],
        "service-desc": [
          {
            href: `${SITE_URL}/.well-known/api-catalog`,
            type: "application/linkset+json",
          },
        ],
      },
      {
        anchor: `${SITE_URL}/api/drafts`,
        "service-doc": [{ href: `${SITE_URL}/llms.txt`, type: "text/plain" }],
      },
      {
        anchor: `${SITE_URL}/api/presets`,
        "service-doc": [{ href: `${SITE_URL}/llms.txt`, type: "text/plain" }],
      },
      {
        anchor: `${SITE_URL}/api/unsplash/search`,
        "service-doc": [{ href: `${SITE_URL}/llms.txt`, type: "text/plain" }],
      },
    ],
  }

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
