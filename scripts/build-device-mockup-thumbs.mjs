#!/usr/bin/env node
/**
 * Upload Postspark device mockup thumbnails to R2 for the devices currently
 * listed in `lib/mockups/index.ts`.
 *
 * The script intentionally derives the device IDs from DEVICE_MOCKUP_FILES so
 * it only mirrors thumbnails for mockups supported by this app.
 *
 * Usage:
 *   pnpm build:device-mockup-thumbs
 *   FORCE=1 pnpm build:device-mockup-thumbs
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const envPath = resolve(projectRoot, ".env.local")
const mockupsPath = resolve(projectRoot, "lib/mockups/index.ts")

try {
  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key]) continue
    process.env[key] = trimmed.slice(eq + 1).trim()
  }
} catch (err) {
  console.warn(`could not read .env.local: ${err.message}`)
}

const REQUIRED_ENV = [
  "R2_S3_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
]
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`missing env: ${key}`)
    process.exit(1)
  }
}

const { R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
  process.env

const POSTSPARK_THUMB_BASE = "https://assets.postspark.app/mockups/thumbnails"
const R2_THUMB_PREFIX = "Device-Mockups/device-mockups/thumbnails"
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6)
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true"

const client = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

function getDeviceIds() {
  const source = readFileSync(mockupsPath, "utf8")
  const filesMatch = source.match(
    /export const DEVICE_MOCKUP_FILES = \[([\s\S]*?)\] as const/
  )

  if (!filesMatch) {
    throw new Error(
      "could not find DEVICE_MOCKUP_FILES in lib/mockups/index.ts"
    )
  }

  const files = [...filesMatch[1].matchAll(/"([^"]+\.webp)"/g)].map(
    (match) => match[1]
  )

  const ids = files.map((file) => {
    const stem = file.replace(/\.webp$/, "")
    const separatorIndex = stem.lastIndexOf("__")
    if (separatorIndex === -1) {
      throw new Error(`unexpected mockup filename: ${file}`)
    }
    return stem.slice(0, separatorIndex)
  })

  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
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

async function uploadIfMissing(key, body) {
  if (!FORCE && (await objectExists(key))) {
    return { skipped: true, size: body.length }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return { skipped: false, size: body.length }
}

async function processOne(deviceId) {
  const srcUrl = `${POSTSPARK_THUMB_BASE}/${deviceId}.webp`
  const key = `${R2_THUMB_PREFIX}/${deviceId}.webp`
  const res = await fetch(srcUrl)

  if (!res.ok) {
    throw new Error(`fetch ${srcUrl} -> ${res.status}`)
  }

  const contentType = res.headers.get("content-type")
  if (contentType && !contentType.includes("image/webp")) {
    throw new Error(`fetch ${srcUrl} returned ${contentType}`)
  }

  const body = Buffer.from(await res.arrayBuffer())
  const uploaded = await uploadIfMissing(key, body)
  const tag = uploaded.skipped ? "·" : "✓"
  console.log(
    `${tag} ${deviceId}  ${(body.length / 1024).toFixed(0)}KB${uploaded.skipped ? " (kept)" : ""}`
  )
}

async function runWithConcurrency(items, n, fn) {
  let cursor = 0
  let failures = 0

  await Promise.all(
    Array.from({ length: n }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        try {
          await fn(items[i])
        } catch (err) {
          failures++
          console.error(`✗ ${items[i]}  ${err.message}`)
        }
      }
    })
  )

  return failures
}

const deviceIds = getDeviceIds()

console.log(
  `uploading ${deviceIds.length} device mockup thumbnails to ${R2_THUMB_PREFIX} (concurrency=${CONCURRENCY})`
)

const failures = await runWithConcurrency(deviceIds, CONCURRENCY, processOne)

if (failures) {
  console.log(`done with ${failures} failures`)
  process.exit(1)
}

console.log("done")
