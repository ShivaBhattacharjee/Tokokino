const SITE_URL = "https://tokokino.com"

export function GET() {
  const metadata = {
    resource: SITE_URL,
    authorization_servers: [SITE_URL],
    scopes_supported: ["openid", "profile", "email"],
    bearer_methods_supported: ["cookie"],
    resource_documentation: `${SITE_URL}/llms.txt`,
  }

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
