#!/usr/bin/env node
/**
 * Upload background images and WebP thumbnails to R2, then write a manifest the
 * editor consumes.
 *
 *   - Reads source images from `Pack/{Mesh,Lines,Gradient,Raycast}`.
 *   - Uploads originals to `Backgrounds/{Category}/{slug}.{ext}` (formats kept as-is).
 *   - Uploads editor-safe previews to `Backgrounds/{Category}/previews/{slug}.webp`.
 *   - Uploads 256px WebP thumbnails to `Backgrounds/{Category}/thumbs/{slug}.webp`.
 *   - Writes `lib/editor/backgrounds-data.json` with the manifest used by the UI.
 *
 * Usage:
 *   pnpm build:backgrounds                   # process all
 *   pnpm build:backgrounds Mesh Raycast      # only those categories
 *   FORCE=1 pnpm build:backgrounds           # re-upload even if object exists
 *   THUMB_SIZE=320 pnpm build:backgrounds    # override thumb size
 *   PREVIEW_SIZE=2400 pnpm build:backgrounds # override editor preview size
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve, extname, join } from "node:path"

import sharp from "sharp"
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const manifestPath = resolve(projectRoot, "lib/editor/backgrounds-data.json")

function resolvePublicBase() {
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE) {
    return process.env.NEXT_PUBLIC_R2_PUBLIC_BASE.replace(/\/$/, "")
  }
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8"))
      const first = parsed?.[0]?.items?.[0]?.full
      if (first) return new URL(first).origin
    } catch {}
  }
  return "https://assets.tokokino.com"
}

const REQUIRED_ENV = [
  "R2_S3_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
]
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) {
    console.error(`missing env: ${k}`)
    process.exit(1)
  }
}

const {
  R2_S3_ENDPOINT,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
} = process.env

const PUBLIC_BASE = resolvePublicBase()

const THUMB_SIZE = Number(process.env.THUMB_SIZE ?? 256)
const THUMB_QUALITY = Number(process.env.THUMB_QUALITY ?? 75)
const PREVIEW_SIZE = Number(process.env.PREVIEW_SIZE ?? 2400)
const PREVIEW_QUALITY = Number(process.env.PREVIEW_QUALITY ?? 85)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4)
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true"

const PACK_DIR = resolve(projectRoot, "Pack")

const CATEGORIES = [
  { dir: "Mesh", key: "mesh", label: "Mesh" },
  { dir: "Lines", key: "lines", label: "Lines" },
  { dir: "Gradient", key: "gradient", label: "Gradient" },
  { dir: "Raycast", key: "raycast", label: "Raycast" },
  // 16:9 to match the dominant source ratio for Mac wallpapers.
  { dir: "Mac", key: "mac", label: "Mac", aspectRatio: 16 / 9 },
  { dir: "Cloud", key: "cloud", label: "Cloud" },
]

const SUPPORTED = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"])

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
}

const args = process.argv.slice(2)
const selected = args.length
  ? CATEGORIES.filter((c) =>
      args.some((a) => a.toLowerCase() === c.dir.toLowerCase() || a.toLowerCase() === c.key)
    )
  : CATEGORIES

if (!selected.length) {
  console.error(`no categories matched: ${args.join(", ")}`)
  process.exit(1)
}

const client = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function prettyName(name) {
  const stem = name.replace(/\.[^.]+$/, "")
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

async function objectExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false
    if (err?.name === "NotFound") return false
    throw err
  }
}

async function uploadIfMissing(key, body, contentType) {
  if (!FORCE && (await objectExists(key))) return { skipped: true, size: body.length }
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return { skipped: false, size: body.length }
}

async function cropToAspectRatio(buffer, targetRatio) {
  const meta = await sharp(buffer, { failOn: "none" }).metadata()
  const { width, height } = meta
  if (!width || !height) return { buffer, width: width ?? 0, height: height ?? 0 }
  const sourceRatio = width / height
  const epsilon = 0.005
  if (Math.abs(sourceRatio - targetRatio) < epsilon) {
    return { buffer, width, height }
  }
  let cropWidth = width
  let cropHeight = height
  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(height * targetRatio)
  } else {
    cropHeight = Math.round(width / targetRatio)
  }
  const left = Math.round((width - cropWidth) / 2)
  const top = Math.round((height - cropHeight) / 2)
  const cropped = await sharp(buffer, { failOn: "none" })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer()
  return { buffer: cropped, width: cropWidth, height: cropHeight }
}

async function processFile(category, file) {
  const ext = extname(file).toLowerCase()
  const slug = slugify(file)
  const fullExt = ext.slice(1)
  const fullKey = `Backgrounds/${category.dir}/${slug}.${fullExt}`
  const previewKey = `Backgrounds/${category.dir}/previews/${slug}.webp`
  const thumbKey = `Backgrounds/${category.dir}/thumbs/${slug}.webp`

  const srcPath = join(PACK_DIR, category.dir, file)
  const srcBuffer = readFileSync(srcPath)

  let workingBuffer = srcBuffer
  if (category.aspectRatio) {
    const { buffer } = await cropToAspectRatio(srcBuffer, category.aspectRatio)
    workingBuffer = buffer
  }

  const fullBuffer = workingBuffer
  const fullContentType = MIME_BY_EXT[ext] ?? "application/octet-stream"

  const previewBuffer = await sharp(workingBuffer, { failOn: "none" })
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PREVIEW_QUALITY, effort: 5 })
    .toBuffer()

  const thumbBuffer = await sharp(workingBuffer, { failOn: "none" })
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: 5 })
    .toBuffer()

  const [fullRes, previewRes, thumbRes] = await Promise.all([
    uploadIfMissing(fullKey, fullBuffer, fullContentType),
    uploadIfMissing(previewKey, previewBuffer, "image/webp"),
    uploadIfMissing(thumbKey, thumbBuffer, "image/webp"),
  ])

  const allSkipped = fullRes.skipped && previewRes.skipped && thumbRes.skipped
  const tag = `${allSkipped ? "·" : "✓"}`
  console.log(
    `${tag} ${category.dir}/${slug}  ` +
      `full ${(fullBuffer.length / 1024).toFixed(0)}KB${fullRes.skipped ? " (kept)" : ""}  ` +
      `preview ${(previewBuffer.length / 1024).toFixed(0)}KB${previewRes.skipped ? " (kept)" : ""}  ` +
      `thumb ${(thumbBuffer.length / 1024).toFixed(0)}KB${thumbRes.skipped ? " (kept)" : ""}`
  )

  return {
    id: slug,
    name: prettyName(file),
    full: `${PUBLIC_BASE}/${fullKey}`,
    preview: `${PUBLIC_BASE}/${previewKey}`,
    thumb: `${PUBLIC_BASE}/${thumbKey}`,
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

const manifest = []
let totalFailures = 0

for (const category of selected) {
  const dir = join(PACK_DIR, category.dir)
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
  console.log(`\n${category.dir} — ${files.length} files`)
  const tasks = files.map((file) => ({ file, category }))
  const { results, failures } = await runWithConcurrency(
    tasks,
    CONCURRENCY,
    ({ file, category }) => processFile(category, file)
  )
  totalFailures += failures
  manifest.push({
    key: category.key,
    label: category.label,
    items: results,
  })
}

if (args.length) {
  // Merge with existing manifest so partial runs don't drop other categories.
  let existing = []
  try {
    existing = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch {}
  const byKey = new Map(existing.map((c) => [c.key, c]))
  for (const cat of manifest) byKey.set(cat.key, cat)
  manifest.length = 0
  for (const cat of CATEGORIES) {
    const found = byKey.get(cat.key)
    if (found) manifest.push(found)
  }
}

const manifestDir = resolve(projectRoot, "lib/editor")
mkdirSync(manifestDir, { recursive: true })
const manifestPath = resolve(manifestDir, "backgrounds-data.json")
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
console.log(`\nwrote manifest → ${manifestPath}`)

if (totalFailures) {
  console.log(`done with ${totalFailures} failures`)
  process.exit(1)
}
console.log("done")
