import { NextResponse } from "next/server"

import { assertTemplateMaintainer, requireSession } from "@/lib/api-auth"
import {
  MAX_TEMPLATE_ASSET_BYTES,
  templateAssetExt,
  uploadTemplateAsset,
} from "@/lib/template-storage"

export const runtime = "nodejs"

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Dev-only publisher for curated template posters and preview clips. Templates
 * are authored by maintainers, not end users, so this endpoint is disabled in
 * production and simply writes the uploaded bytes to R2 under a slug-derived
 * key, returning the permanent public URL to drop into the catalogue.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const forbidden = assertTemplateMaintainer(auth.session)
  if (forbidden) return forbidden

  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? ""
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Invalid slug (use kebab-case)" },
      { status: 400 }
    )
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase()
  if (!templateAssetExt(contentType)) {
    return NextResponse.json(
      { error: "Asset must be a JPEG, PNG, WebP, WebM, or MP4" },
      { status: 415 }
    )
  }

  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "Missing asset" }, { status: 400 })
  }
  if (body.byteLength > MAX_TEMPLATE_ASSET_BYTES) {
    return NextResponse.json({ error: "Asset is too large" }, { status: 413 })
  }

  try {
    const { url } = await uploadTemplateAsset({ slug, body, contentType })
    return NextResponse.json({ url })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not publish template asset" },
      { status: 500 }
    )
  }
}
