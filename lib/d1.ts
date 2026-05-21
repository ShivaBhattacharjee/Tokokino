import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "@/lib/db/schema"

const D1_BINDING = "TOKOKINO_DB"

export function getD1Database() {
  const binding = getCloudflareContext().env[D1_BINDING]
  if (!binding) {
    throw new Error(`Missing D1 binding: ${D1_BINDING}`)
  }
  return binding
}

export function getDb() {
  return drizzle(getD1Database(), { schema })
}

export function toD1Date(value: Date) {
  return value.toISOString()
}

export function fromD1Date(value: string | null | undefined) {
  return value ? new Date(value) : null
}
