const SITE_URL = "https://tokokino.com"

export function GET() {
  const card = {
    serverInfo: {
      name: "tokokino",
      version: "1.0.0",
      description:
        "Screenshot beautifier — style, annotate, and share screenshots as polished images.",
      url: SITE_URL,
    },
    endpoint: `${SITE_URL}/mcp`,
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    auth: {
      type: "session",
      documentation: `${SITE_URL}/auth.md`,
    },
  }

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
