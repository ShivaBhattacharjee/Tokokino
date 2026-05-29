import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getAuth } from "@/lib/auth"
import {
  getUserShares,
  getUserStorageUsage,
  MAX_USER_SHARE_STORAGE_BYTES,
} from "@/lib/share-db"

import { SharesGallery } from "./shares-gallery"

export const metadata: Metadata = {
  title: "My Shares — Tokokino",
  description: "View and manage your shared Tokokino screenshots.",
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function SharesPage() {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/login?callbackURL=/shares")
  }

  const [shares, storageUsed] = await Promise.all([
    getUserShares(session.user.id).catch(() => []),
    getUserStorageUsage(session.user.id).catch(() => 0),
  ])

  const serialized = shares.map((s) => ({
    id: s.id,
    imageUrl: s.imageUrl,
    viewCount: s.viewCount,
    sizeBytes: s.sizeBytes,
    createdAt: s.createdAt.toISOString(),
  }))

  return (
    <SharesGallery
      shares={serialized}
      storageUsed={storageUsed}
      storageLimit={MAX_USER_SHARE_STORAGE_BYTES}
    />
  )
}
