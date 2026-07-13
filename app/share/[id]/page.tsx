import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getShareImageUrl, isValidShareId } from "@/lib/share"
import { getShareById, recordShareView } from "@/lib/share-db"
import { ShareView } from "./share-view"

export const metadata: Metadata = {
  title: "Shared media - Tokokino",
  description:
    "View, copy, or download a shared Tokokino screenshot or animation.",
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
  // Fall back to metadata-only fetch if view tracking fails.
  const meta = share ?? (await getShareById(id).catch(() => null))
  return (
    <ShareView
      id={id}
      imageUrl={getShareImageUrl(id)}
      sharedBy={meta?.userName ?? null}
      views={meta?.uniqueViewCount ?? null}
      contentType={meta?.contentType ?? "image/png"}
      shareType={meta?.type ?? "style"}
    />
  )
}
