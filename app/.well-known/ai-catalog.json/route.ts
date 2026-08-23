const SITE_URL = "https://tokokino.com"

export function GET() {
  const catalog = {
    specVersion: "1.0",
    host: {
      displayName: "Tokokino",
      identifier: "did:web:tokokino.com",
      documentationUrl: `${SITE_URL}/llms.txt`,
      logoUrl: `${SITE_URL}/logo.png`,
    },
    entries: [
      {
        identifier: "urn:air:tokokino.com:docs:llms-txt",
        displayName: "Tokokino Product Guide",
        type: "text/markdown",
        url: `${SITE_URL}/llms.txt`,
        description:
          "Overview of Tokokino — a browser-based screenshot, mockup, and animated-demo editor — including when to use it and how agents should drive the editor.",
        tags: ["screenshots", "mockups", "design", "video", "documentation"],
        representativeQueries: [
          "what tool can turn a raw screenshot into a polished launch graphic",
          "free open source alternative to shots.so or postspark",
          "how should an agent use tokokino to edit a screenshot",
          "make an animated product demo from a screen recording",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:api:openapi",
        displayName: "Tokokino API (OpenAPI)",
        type: "application/vnd.oai.openapi+json",
        url: `${SITE_URL}/openapi.json`,
        description:
          "OpenAPI 3.1 specification for the Tokokino HTTP API — share links, cloud drafts, custom presets, editor preferences, and media proxies.",
        tags: ["openapi", "api", "rest", "screenshots"],
        capabilities: [
          "CreateShare",
          "ListDrafts",
          "CreatePreset",
          "CaptureUrl",
          "SearchUnsplash",
        ],
        representativeQueries: [
          "what http endpoints does tokokino expose",
          "openapi spec for creating a screenshot share link",
          "how do I upload a video share to tokokino",
          "authenticate against the tokokino api",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:docs:developers",
        displayName: "Tokokino Developer Portal",
        type: "text/html",
        url: `${SITE_URL}/developers`,
        description:
          "Developer documentation for the Tokokino API: quickstart, session authentication, endpoint reference, JSON error codes, limits, and agent resources.",
        tags: ["documentation", "developers", "api"],
        representativeQueries: [
          "tokokino developer documentation",
          "how do I get started with the tokokino api",
          "what error codes does the tokokino api return",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:server:tokokino",
        displayName: "Tokokino MCP Server",
        type: "application/mcp-server-card+json",
        url: `${SITE_URL}/.well-known/mcp/server-card.json`,
        description:
          "MCP server card for Tokokino. The server is not live yet — the endpoint answers 503 with a coming-soon payload until it ships.",
        tags: ["mcp", "screenshots", "editor", "coming-soon"],
        metadata: { status: "coming_soon" },
        representativeQueries: [
          "find an mcp server that beautifies screenshots",
          "connect to tokokino over the model context protocol",
          "which mcp servers can style and export images",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:skill:share",
        displayName: "Tokokino Share Links",
        type: "application/ai-skill+md",
        url: `${SITE_URL}/.well-known/agent-skills/share.md`,
        description:
          "Create and retrieve public share links for beautified screenshots, including share metadata and the rendered image.",
        tags: ["sharing", "screenshots", "links"],
        capabilities: ["CreateShare", "GetShare", "GetShareImage"],
        representativeQueries: [
          "publish a screenshot to a public link",
          "get a shareable url for an edited image",
          "look up the view count for a share",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:skill:drafts",
        displayName: "Tokokino Drafts",
        type: "application/ai-skill+md",
        url: `${SITE_URL}/.well-known/agent-skills/drafts.md`,
        description:
          "Save and restore Tokokino editor state as named drafts, including listing, updating, deleting, and fetching draft thumbnails.",
        tags: ["drafts", "persistence", "editor-state"],
        capabilities: [
          "ListDrafts",
          "CreateDraft",
          "UpdateDraft",
          "DeleteDraft",
        ],
        representativeQueries: [
          "save my screenshot editing session to resume later",
          "list the drafts saved in tokokino",
          "restore a previously saved editor state",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:skill:presets",
        displayName: "Tokokino Style Presets",
        type: "application/ai-skill+md",
        url: `${SITE_URL}/.well-known/agent-skills/presets.md`,
        description:
          "Manage reusable custom style presets — backgrounds, shadows, framing, and layout — for the Tokokino screenshot editor.",
        tags: ["presets", "styling", "branding"],
        capabilities: [
          "ListPresets",
          "CreatePreset",
          "UpdatePreset",
          "DeletePreset",
        ],
        representativeQueries: [
          "reuse a saved screenshot style across images",
          "create a branded preset for product screenshots",
          "apply consistent backgrounds and shadows to every capture",
        ],
      },
      {
        identifier: "urn:air:tokokino.com:catalog:api",
        displayName: "Tokokino API Catalog",
        type: "application/linkset+json",
        url: `${SITE_URL}/.well-known/api-catalog`,
        description:
          "RFC 9727 linkset of Tokokino's published machine interfaces and the documentation describing them.",
        tags: ["api", "linkset", "discovery"],
        representativeQueries: [
          "which tokokino http apis are documented for agents",
          "find the api catalog for tokokino",
        ],
      },
    ],
  }

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
