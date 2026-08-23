const SITE_URL = "https://tokokino.com"

const MARKDOWN_404 = `# 404 — Page not found

The requested Tokokino path does not exist. Use one of these public entry points to recover:

- [Tokokino homepage](${SITE_URL}/)
- [Open the editor](${SITE_URL}/app)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Agent instructions](${SITE_URL}/llms.txt)
`

export const dynamic = "force-static"

export function GET() {
  return new Response(MARKDOWN_404, {
    status: 404,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
    },
  })
}
