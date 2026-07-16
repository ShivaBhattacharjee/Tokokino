/**
 * Dev-only endpoint: persist video/animation export debug payloads under
 * `debug/video-export/` so Safari/WebKit filter failures can be inspected after
 * a local export run.
 *
 * Disabled outside development (returns 403).
 */

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Dev-only, localhost: layer PNGs arrive base64-inlined and run several MB each.
const MAX_BODY_BYTES = 64 * 1024 * 1024

function isSafeSessionId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9-]{6,64}$/i.test(id)
}

function isSafeKind(kind: unknown): kind is string {
  return kind === "video-media" || kind === "animation"
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "export-debug is disabled in production" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 })
    }
    body = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const payload = body as {
    sessionId?: unknown
    kind?: unknown
    status?: unknown
    layers?: unknown
  }

  if (!isSafeSessionId(payload.sessionId) || !isSafeKind(payload.kind)) {
    return NextResponse.json(
      { error: "sessionId/kind missing or invalid" },
      { status: 400 }
    )
  }

  const status =
    typeof payload.status === "string"
      ? payload.status.replace(/[^a-z]/gi, "")
      : "unknown"
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `${stamp}_${payload.kind}_${payload.sessionId}_${status || "log"}.json`

  const dir = path.join(process.cwd(), "debug", "video-export")
  await mkdir(dir, { recursive: true })

  // Layer PNGs go to disk as real images so they can be opened and compared;
  // inlining megabytes of base64 into the JSON would only make it unreadable.
  const writtenLayers: string[] = []
  const layers = payload.layers
  if (layers && typeof layers === "object") {
    const base = `${stamp}_${payload.kind}_${payload.sessionId}`
    for (const [name, value] of Object.entries(
      layers as Record<string, unknown>
    )) {
      if (typeof value !== "string") continue
      if (!/^[a-z0-9-]{1,32}$/i.test(name)) continue
      const match = /^data:image\/png;base64,(.+)$/.exec(value)
      if (!match) continue
      const layerFile = `${base}_layer-${name}.png`
      await writeFile(
        path.join(dir, layerFile),
        Buffer.from(match[1], "base64")
      )
      writtenLayers.push(layerFile)
    }
    delete (body as { layers?: unknown }).layers
  }

  const filePath = path.join(dir, filename)
  await writeFile(filePath, JSON.stringify(body, null, 2), "utf8")

  const rel = path.join("debug", "video-export", filename)
  console.info(`[export-debug] wrote ${rel}`)
  for (const layer of writtenLayers) {
    console.info(
      `[export-debug] wrote ${path.join("debug", "video-export", layer)}`
    )
  }

  return NextResponse.json({
    ok: true,
    path: rel,
    layers: writtenLayers,
  })
}
