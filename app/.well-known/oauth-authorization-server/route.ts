const SITE_URL = "https://tokokino.com"

export function GET() {
  const metadata = {
    issuer: SITE_URL,
    authorization_endpoint: `${SITE_URL}/login`,
    token_endpoint: `${SITE_URL}/api/auth/sign-in/email`,
    jwks_uri: null,
    registration_endpoint: `${SITE_URL}/api/auth/sign-up/email`,
    scopes_supported: ["openid", "profile", "email"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    claims_supported: ["sub", "email", "name"],
    service_documentation: `${SITE_URL}/llms.txt`,
    agent_auth: {
      skill: `${SITE_URL}/auth.md`,
      register_uri: `${SITE_URL}/api/auth/sign-up/email`,
      claim_uri: `${SITE_URL}/api/auth/sign-in/email`,
      identity_types_supported: ["anonymous", "identity_assertion"],
      anonymous: {
        credential_types_supported: ["session_cookie"],
      },
      identity_assertion: {
        assertion_types_supported: ["verified_email"],
        credential_types_supported: ["session_cookie"],
      },
    },
  }

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
