#!/usr/bin/env node
/**
 * Download the glass-frame picker wallpaper, crop it to the glass screen
 * opening (1182×732), compress to WebP, and upload it to R2.
 *
 * Usage:
 *   pnpm build:glass-preview
 *   FORCE=1 pnpm build:glass-preview
 *   DRY=1 pnpm build:glass-preview
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")

const SOURCE_URL =
  process.env.SOURCE_URL ??
  "https://images.unsplash.com/photo-1744632040701-6eba26117b67?q=80&w=2400&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"

const PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "https://assets.tokokino.com"
).replace(/\/$/, "")
const OBJECT_KEY = process.env.OBJECT_KEY ?? "frames/glass-preview.webp"

const TARGET_WIDTH = Number(process.env.WIDTH ?? 1182)
const TARGET_HEIGHT = Number(process.env.HEIGHT ?? 732)
const QUALITY = Number(process.env.QUALITY ?? 78)
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true"
const DRY = process.env.DRY === "1" || process.env.DRY === "true"

function resolveEndpoint() {
  if (process.env.R2_S3_ENDPOINT) return process.env.R2_S3_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }
  return null
}

const ENDPOINT = resolveEndpoint()

let client = null
if (!DRY) {
  const missing = [
    "R2_BUCKET",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ].filter((key) => !process.env[key])
  if (!ENDPOINT) missing.push("R2_S3_ENDPOINT (or R2_ACCOUNT_ID)")
  if (missing.length) {
    console.error(`missing env: ${missing.join(", ")}`)
    console.error("run with DRY=1 to compress locally without uploading")
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

async function objectExists(key) {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
    )
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false
    if (err?.name === "NotFound") return false
    throw err
  }
}

async function downloadSource(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "tokokino-glass-preview/1.0" },
  })
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function compressPreview(source) {
  return sharp(source, { failOn: "none" })
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer()
}

async function main() {
  console.log(`source  ${SOURCE_URL}`)
  const source = await downloadSource(SOURCE_URL)
  const preview = await compressPreview(source)
  const meta = await sharp(preview).metadata()
  console.log(
    `webp    ${meta.width}×${meta.height}  ${(preview.length / 1024).toFixed(1)} KB  q=${QUALITY}`
  )

  if (DRY) {
    const out = resolve(projectRoot, "scripts/.build", OBJECT_KEY)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, preview)
    console.log(`wrote   ${out}`)
    return
  }

  if (!FORCE && (await objectExists(OBJECT_KEY))) {
    console.log(`skip    ${OBJECT_KEY} already exists (FORCE=1 to overwrite)`)
  } else {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: OBJECT_KEY,
        Body: preview,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
    console.log(`upload  ${OBJECT_KEY}`)
  }

  console.log(`public  ${PUBLIC_BASE}/${OBJECT_KEY}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
