import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getShareImageUrl, isValidShareId } from "@/lib/share"
import { recordShareView } from "@/lib/share-db"
import { ShareView } from "./share-view"

export const metadata: Metadata = {
  title: "Shared screenshot - Tokokino",
  description: "View, copy, or download a shared Tokokino screenshot.",
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!isValidShareId(id)) {
    notFound()
  }

  const requestHeaders = await headers()
  const share = await recordShareView(id, requestHeaders).catch((error) => {
    console.error(error)
    return null
  })

  return (
    <ShareView
      id={id}
      imageUrl={getShareImageUrl(id)}
      sharedBy={share?.userName ?? null}
      views={share?.uniqueViewCount ?? null}
    />
  )
}
