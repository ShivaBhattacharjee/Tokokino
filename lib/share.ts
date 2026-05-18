import { env } from "@/lib/env"

export const SHARE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidShareId(id: string) {
  return SHARE_ID_PATTERN.test(id)
}

export function getShareObjectKey(id: string) {
  return `shares/${id}.png`
}

export function getPublicShareImageUrl(id: string) {
  const publicBase = env.NEXT_PUBLIC_R2_PUBLIC_BASE.replace(/\/$/, "")
  return `${publicBase}/${getShareObjectKey(id)}`
}
