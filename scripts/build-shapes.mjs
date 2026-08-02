#!/usr/bin/env node
/**
 * Upload 3D shape PNGs and WebP thumbnails to R2, then write a manifest the
 * editor consumes.
 *
 *   - Reads source images from `shapes/*` (every pack folder, flattened).
 *   - Uploads full-size shapes to `Shapes/{slug}.webp` (alpha preserved).
 *   - Uploads 256px WebP thumbnails to `Shapes/thumbs/{slug}.webp`.
 *   - Writes `lib/editor/shapes-data.json` with the manifest used by the UI.
 *
 * Usage:
 *   pnpm build:shapes                  # process all packs
 *   DRY=1 pnpm build:shapes            # no upload; writes shapes/.build for auditing
 *   FORCE=1 pnpm build:shapes          # re-upload even if object exists
 *   TRIM=1 pnpm build:shapes           # crop away transparent margins first
 *   MAX_W=1920 MAX_H=1920 pnpm build:shapes
 *   FORMAT=png pnpm build:shapes       # full-size as PNG instead of WebP
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve, extname, join } from "node:path"

import sharp from "sharp"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const manifestPath = resolve(projectRoot, "lib/editor/shapes-data.json")
const backgroundsManifestPath = resolve(projectRoot, "lib/editor/backgrounds-data.json")

const SHAPES_DIR = resolve(projectRoot, "shapes")
const KEY_PREFIX = process.env.KEY_PREFIX ?? "Shapes"

const MAX_W = Number(process.env.MAX_W ?? 1920)
const MAX_H = Number(process.env.MAX_H ?? 1080)
const FULL_FORMAT = (process.env.FORMAT ?? "webp").toLowerCase()
const FULL_QUALITY = Number(process.env.QUALITY ?? 90)
const THUMB_SIZE = Number(process.env.THUMB_SIZE ?? 256)
const THUMB_QUALITY = Number(process.env.THUMB_QUALITY ?? 75)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4)
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true"
const DRY = process.env.DRY === "1" || process.env.DRY === "true"
const TRIM = process.env.TRIM === "1" || process.env.TRIM === "true"

if (FULL_FORMAT !== "webp" && FULL_FORMAT !== "png") {
  console.error(`FORMAT must be webp or png, got: ${FULL_FORMAT}`)
  process.exit(1)
}

// Each pack folder collapses into one flat namespace; the prefix keeps ids unique.
const PACKS = [
  { dir: "abstract-3d-holographic", prefix: "holo" },
  { dir: "assetpro-free-3d", prefix: "" },
]

const SUPPORTED = new Set([".png", ".webp", ".jpg", ".jpeg", ".avif"])

function resolvePublicBase() {
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE) {
    return process.env.NEXT_PUBLIC_R2_PUBLIC_BASE.replace(/\/$/, "")
  }
  for (const path of [manifestPath, backgroundsManifestPath]) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"))
      const first = parsed?.[0]?.full ?? parsed?.[0]?.items?.[0]?.full
      if (first) return new URL(first).origin
    } catch {}
  }
  return "https://assets.tokokino.com"
}

function resolveEndpoint() {
  if (process.env.R2_S3_ENDPOINT) return process.env.R2_S3_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }
  return null
}

const PUBLIC_BASE = resolvePublicBase()
const ENDPOINT = resolveEndpoint()

let client = null
if (!DRY) {
  const missing = ["R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
    (k) => !process.env[k]
  )
  if (!ENDPOINT) missing.push("R2_S3_ENDPOINT (or R2_ACCOUNT_ID)")
  if (missing.length) {
    console.error(`missing env: ${missing.join(", ")}`)
    console.error("run with DRY=1 to build locally without uploading")
    process.exit(1)
  }
  client = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Source layer names are mostly junk ("r22", "g70 1", "4 35"), so the label is
// just the pack plus its number — shapes get picked from the thumbnail anyway.
function prettyName(slug) {
  const numbered = slug.match(/^(holo|free)-(\d+)/)
  if (numbered) {
    const [, pack, n] = numbered
    return `${pack === "holo" ? "Holo" : "Free"} ${n}`
  }
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

async function objectExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false
    if (err?.name === "NotFound") return false
    throw err
  }
}

async function uploadIfMissing(key, body, contentType) {
  if (!FORCE && (await objectExists(key))) return { skipped: true }
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return { skipped: false }
}

function writeLocal(key, body) {
  const out = resolve(SHAPES_DIR, ".build", key)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, body)
}

async function processFile({ pack, file }) {
  const srcPath = join(SHAPES_DIR, pack.dir, file)
  const slug = slugify(pack.prefix ? `${pack.prefix}-${file}` : file)

  const fullExt = FULL_FORMAT === "png" ? "png" : "webp"
  const fullKey = `${KEY_PREFIX}/${slug}.${fullExt}`
  const thumbKey = `${KEY_PREFIX}/thumbs/${slug}.webp`

  let pipeline = sharp(readFileSync(srcPath), { failOn: "none" })
  // Source packs frame each shape in a large transparent canvas; trimming makes
  // the asset tight to the artwork so the editor can scale it predictably.
  if (TRIM) pipeline = pipeline.trim()
  const base = await pipeline
    .resize(MAX_W, MAX_H, { fit: "inside", withoutEnlargement: true })
    .toBuffer()

  const fullBuffer =
    FULL_FORMAT === "png"
      ? await sharp(base).png({ compressionLevel: 9, palette: true }).toBuffer()
      : await sharp(base).webp({ quality: FULL_QUALITY, effort: 5, alphaQuality: 100 }).toBuffer()

  const thumbBuffer = await sharp(base)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: 5, alphaQuality: 100 })
    .toBuffer()

  const meta = await sharp(fullBuffer).metadata()

  let tag = "✓"
  if (DRY) {
    writeLocal(fullKey, fullBuffer)
    writeLocal(thumbKey, thumbBuffer)
    tag = "·"
  } else {
    const [fullRes, thumbRes] = await Promise.all([
      uploadIfMissing(fullKey, fullBuffer, FULL_FORMAT === "png" ? "image/png" : "image/webp"),
      uploadIfMissing(thumbKey, thumbBuffer, "image/webp"),
    ])
    if (fullRes.skipped && thumbRes.skipped) tag = "·"
  }

  console.log(
    `${tag} ${slug}  ${meta.width}x${meta.height}  ` +
      `full ${(fullBuffer.length / 1024).toFixed(0)}KB  ` +
      `thumb ${(thumbBuffer.length / 1024).toFixed(0)}KB`
  )

  return {
    id: slug,
    name: prettyName(slug),
    full: `${PUBLIC_BASE}/${fullKey}`,
    thumb: `${PUBLIC_BASE}/${thumbKey}`,
    width: meta.width,
    height: meta.height,
    bytes: fullBuffer.length,
  }
}

async function runWithConcurrency(items, n, fn) {
  const out = new Array(items.length)
  let cursor = 0
  let failures = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        try {
          out[i] = await fn(items[i])
        } catch (err) {
          failures++
          console.error(`✗ ${items[i].file}: ${err.message}`)
        }
      }
    })
  )
  return { results: out.filter(Boolean), failures }
}

const tasks = []
for (const pack of PACKS) {
  const dir = join(SHAPES_DIR, pack.dir)
  let files
  try {
    files = readdirSync(dir)
      .filter((f) => SUPPORTED.has(extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch (err) {
    console.error(`cannot read ${dir}: ${err.message}`)
    continue
  }
  if (!files.length) {
    console.warn(`no images in ${dir}`)
    continue
  }
  for (const file of files) tasks.push({ pack, file })
}

if (!tasks.length) {
  console.error(`no shapes found under ${SHAPES_DIR}`)
  process.exit(1)
}

console.log(
  `${tasks.length} shapes → ${DRY ? "shapes/.build" : `${PUBLIC_BASE}/${KEY_PREFIX}`}  ` +
    `(max ${MAX_W}x${MAX_H}, ${FULL_FORMAT}${TRIM ? ", trimmed" : ""})\n`
)

const { results, failures } = await runWithConcurrency(tasks, CONCURRENCY, processFile)

const duplicates = results.length - new Set(results.map((r) => r.id)).size
if (duplicates) {
  console.error(`\n${duplicates} duplicate ids — manifest would drop shapes, aborting`)
  process.exit(1)
}

results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(manifestPath, JSON.stringify(results, null, 2) + "\n")

const totalMb = results.reduce((sum, r) => sum + r.bytes, 0) / 1e6
console.log(`\nwrote manifest → ${manifestPath}`)
console.log(`${results.length} shapes, ${totalMb.toFixed(1)}MB total`)

if (failures) {
  console.log(`done with ${failures} failures`)
  process.exit(1)
}
console.log("done")
