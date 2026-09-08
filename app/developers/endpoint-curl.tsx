import { CodeSample } from "./code-sample"

const BASE = "https://tokokino.com"
const TOKEN = "tk_<your-personal-access-token>"

function curlForEndpoint(method: string, path: string): string {
  const resolved = path.replace("{id}", "abc123").replace("{partNumber}", "1")
  const url = `${BASE}${resolved}`
  const auth = `-H "Authorization: Bearer ${TOKEN}"`
  const json = (body: string) =>
    [
      `curl -X ${method} "${url}" \\`,
      `  ${auth} \\`,
      `  -H "Content-Type: application/json" \\`,
      `  --data '${body}'`,
    ].join("\n")

  switch (`${method} ${path}`) {
    case "POST /api/share":
      return [
        `curl -X POST ${BASE}/api/share \\`,
        `  -H "Content-Type: image/png" \\`,
        `  ${auth} \\`,
        `  --data-binary @screenshot.png`,
      ].join("\n")
    case "POST /api/share/uploads":
      return json('{"contentType": "video/mp4", "sizeBytes": 104857600}')
    case "POST /api/share/uploads/{id}/complete":
      return [`curl -X POST "${url}" \\`, `  ${auth}`].join("\n")
    case "POST /api/drafts":
      return json('{"name": "Landing hero", "state": {}}')
    case "PATCH /api/drafts/{id}":
      return json('{"name": "Landing hero v2"}')
    case "POST /api/presets":
      return json('{"name": "Hero split", "type": "style", "geometry": {}}')
    case "PUT /api/preferences":
      return json('{"exportFilenameFormat": "tokokino_export_{SCALE}_{DATE}"}')
    case "POST /api/tokens":
      return json('{"name": "CI upload script", "expiresAt": null}')
    case "POST /api/screenshot":
      return json(
        '{"url": "https://example.com", "width": 1920, "aspectRatio": "16/9"}'
      )
    case "GET /api/drafts":
      return [`curl "${url}?limit=20" \\`, `  ${auth}`].join("\n")
    case "GET /api/tweet":
      return [
        `curl "${url}?url=https://x.com/acme/status/123456789" \\`,
        `  ${auth}`,
      ].join("\n")
    case "GET /api/unsplash/search":
      return [`curl "${url}?q=mountains" \\`, `  ${auth}`].join("\n")
    case "GET /api/export/image":
      return [
        `curl "${url}?url=https://example.com/photo.jpg" \\`,
        `  ${auth}`,
      ].join("\n")
    default:
      return method === "GET"
        ? [`curl "${url}" \\`, `  ${auth}`].join("\n")
        : [`curl -X ${method} "${url}" \\`, `  ${auth}`].join("\n")
  }
}

export function EndpointCurl({
  method,
  path,
}: {
  method: string
  path: string
}) {
  return (
    <CodeSample
      className="mt-3"
      filename="request.sh"
      code={curlForEndpoint(method, path)}
    />
  )
}
