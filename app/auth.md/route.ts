const SITE_URL = "https://tokokino.com"

const CONTENT = `# auth.md

Tokokino is a browser-based screenshot beautifier. Protected APIs require an authenticated session obtained via email/password or Google OAuth through [better-auth](https://www.better-auth.com/).

## Discovery

- OAuth Authorization Server: ${SITE_URL}/.well-known/oauth-authorization-server
- OAuth Protected Resource: ${SITE_URL}/.well-known/oauth-protected-resource

## Registration

Agents authenticate by signing in through the email/password endpoint:

\`\`\`
POST ${SITE_URL}/api/auth/sign-in/email
Content-Type: application/json

{ "email": "...", "password": "..." }
\`\`\`

The response sets a session cookie used for all subsequent API calls.

## Credential Usage

Include the session cookie returned from sign-in in all requests to protected endpoints:
- \`/api/share\` — create and manage share links
- \`/api/drafts\` — save and retrieve editor drafts
- \`/api/presets\` — manage custom presets

## Session Lifecycle

Sessions expire after inactivity. Re-authenticate using the sign-in endpoint to obtain a fresh session cookie. There is no token revocation endpoint; sessions expire server-side automatically.
`

export function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
