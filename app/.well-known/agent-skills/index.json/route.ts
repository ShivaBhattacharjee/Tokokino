const SITE_URL = "https://tokokino.com"

export function GET() {
  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "share",
        type: "skill-md",
        description:
          "Create and retrieve public share links for beautified screenshots.",
        url: `${SITE_URL}/.well-known/agent-skills/share.md`,
        digest:
          "sha256:ded563b660d0b7d6eb3bd838659122f2d5c3ab1bb3987c47f13440a66bbaea06",
      },
      {
        name: "drafts",
        type: "skill-md",
        description: "Save and restore editor state as named drafts.",
        url: `${SITE_URL}/.well-known/agent-skills/drafts.md`,
        digest:
          "sha256:f2b3f33f629fb9eef754c3abcf1cc7ce9ea9358761b95149aa992c7ce937ade9",
      },
      {
        name: "presets",
        type: "skill-md",
        description: "Manage custom style presets for the screenshot editor.",
        url: `${SITE_URL}/.well-known/agent-skills/presets.md`,
        digest:
          "sha256:c23ee2384821f9ac5ee649fe9b40e3ccdcaf19e44302ef4e06246f2b82d9862d",
      },
    ],
  }

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
