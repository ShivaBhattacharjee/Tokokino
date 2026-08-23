const SITE_URL = "https://tokokino.com"

const BODY = {
  status: "coming_soon",
  message:
    "The Tokokino MCP server is not available yet. This endpoint is reserved for it and will start speaking the Model Context Protocol once the server ships.",
  hint: `Until then, drive Tokokino through the HTTP API described at ${SITE_URL}/openapi.json, or read ${SITE_URL}/developers for the developer documentation.`,
  serverCard: `${SITE_URL}/.well-known/mcp/server-card.json`,
  docs: `${SITE_URL}/developers`,
}

function comingSoon() {
  // 503 + Retry-After, not 404: the endpoint is reserved and announced in the
  // server card, it just is not serving MCP yet. A 404 would tell clients the
  // address is wrong rather than not-yet-live.
  return new Response(JSON.stringify(BODY, null, 2), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Retry-After": "86400",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

export const GET = comingSoon
export const POST = comingSoon
export const DELETE = comingSoon
