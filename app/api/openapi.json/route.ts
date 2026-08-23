import { openApiSpec } from "@/lib/openapi/spec"

export const dynamic = "force-static"

export function GET() {
  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
