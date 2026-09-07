const SITE_URL = "https://tokokino.com"

const CONTENT = `# auth.md

Tokokino is a browser-based screenshot beautifier. Protected APIs accept a personal access token or an authenticated session obtained via email/password or Google OAuth through [better-auth](https://www.better-auth.com/).

## Discovery

- OAuth Authorization Server: ${SITE_URL}/.well-known/oauth-authorization-server
- OAuth Protected Resource: ${SITE_URL}/.well-known/oauth-protected-resource

## Personal access tokens (recommended for scripts, CI, and agents)

Generate a token in the editor under Settings → Developer. The plaintext token is shown exactly once — store it somewhere safe, because it is kept only as a SHA-256 hash afterwards. Tokens act as your account, optionally expire, and can be revoked at any time.

Send the token as a bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer tk_<your-personal-access-token>
\`\`\`

Example:

\`\`\`
curl -X POST ${SITE_URL}/api/share \\
  -H "Content-Type: image/png" \\
  -H "Authorization: Bearer tk_<your-personal-access-token>" \\
  --data-binary @screenshot.png
\`\`\`

Manage tokens programmatically (these endpoints accept a token or a session):

- \`GET /api/tokens\` — list tokens (plaintext is never returned again)
- \`POST /api/tokens\` — generate a token: \`{ "name": "CI upload script", "expiresAt": "2026-12-31T00:00:00.000Z" }\` (\`expiresAt\` is optional)
- \`DELETE /api/tokens/{id}\` — revoke a token immediately

## Session cookies (browser callers)

Agents driving a real browser session can sign in through the email/password endpoint instead:

\`\`\`
POST ${SITE_URL}/api/auth/sign-in/email
Content-Type: application/json

{ "email": "...", "password": "..." }
\`\`\`

The response sets a session cookie used for all subsequent API calls. A better-auth session token also works as a bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <session-token>
\`\`\`

Protected endpoints:
- \`/api/share\` — create and manage share links
- \`/api/drafts\` — save and retrieve editor drafts
- \`/api/presets\` — manage custom presets
- \`/api/tokens\` — manage personal access tokens

## Session Lifecycle

Sessions expire after inactivity. Re-authenticate using the sign-in endpoint to obtain a fresh session. To explicitly revoke a session:

\`\`\`
POST ${SITE_URL}/api/auth/sign-out
\`\`\`
`

export function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
