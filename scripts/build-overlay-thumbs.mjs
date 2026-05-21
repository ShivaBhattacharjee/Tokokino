#!/usr/bin/env node
/**
 * Generate WebP thumbnails for the overlay PNGs and upload them back to R2
 * under `overlays/thumbs/{id}.webp`.
 *
 * Reads source PNGs from the public R2 URL (no auth needed) and writes
 * thumbnails using S3 credentials from .env.local.
 *
 * Usage:
 *   pnpm build:thumbs                 # generate 1..100
 *   pnpm build:thumbs 5 12 87         # only those ids
 *   THUMB_SIZE=320 pnpm build:thumbs  # override size
 */

import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import sharp from "sharp"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

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

const {
  R2_S3_ENDPOINT,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
} = process.env

const NEXT_PUBLIC_R2_PUBLIC_BASE = resolvePublicBase()
const NEXT_PUBLIC_OVERLAYS_BASE_URL = `${NEXT_PUBLIC_R2_PUBLIC_BASE?.replace(/\/$/, "")}/overlays`

for (const k of [
  "R2_S3_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
]) {
  if (!process.env[k]) {
    console.error(`missing env: ${k}`)
    process.exit(1)
  }
}

const THUMB_SIZE = Number(process.env.THUMB_SIZE ?? 256)
const QUALITY = Number(process.env.THUMB_QUALITY ?? 75)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6)

const argIds = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0)
const ids = argIds.length ? argIds : Array.from({ length: 100 }, (_, i) => i + 1)

const client = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

const pad = (n) => String(n).padStart(3, "0")

async function processOne(id) {
  const padded = pad(id)
  const srcUrl = `${NEXT_PUBLIC_OVERLAYS_BASE_URL.replace(/\/$/, "")}/${padded}.png`
  const res = await fetch(srcUrl)
  if (!res.ok) throw new Error(`fetch ${srcUrl} → ${res.status}`)
  const png = Buffer.from(await res.arrayBuffer())

  const webp = await sharp(png)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer()

  const key = `overlays/thumbs/${padded}.webp`
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: webp,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  const ratio = ((webp.length / png.length) * 100).toFixed(1)
  console.log(
    `✓ ${padded}  ${(png.length / 1024).toFixed(0)}KB → ${(webp.length / 1024).toFixed(0)}KB (${ratio}%)`
  )
}

async function runWithConcurrency(items, n, fn) {
  const results = []
  let cursor = 0
  const workers = Array.from({ length: n }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      try {
        await fn(items[i])
      } catch (err) {
        console.error(`✗ ${pad(items[i])}  ${err.message}`)
        results.push({ id: items[i], err })
      }
    }
  })
  await Promise.all(workers)
  return results
}

console.log(
  `building ${ids.length} thumbs @ ${THUMB_SIZE}px q${QUALITY} (concurrency=${CONCURRENCY})`
)
const failures = await runWithConcurrency(ids, CONCURRENCY, processOne)
console.log(failures.length ? `done with ${failures.length} failures` : "done")
process.exit(failures.length ? 1 : 0)
