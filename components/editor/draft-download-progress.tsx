"use client"

import { RiDownloadCloud2Line } from "@remixicon/react"

import {
  CornerProgressCard,
  formatBytes,
  useTransferEta,
} from "@/components/editor/corner-progress"

export type DraftDownloadState = {
  /** Project name, if known yet. Null until the draft metadata resolves. */
  name: string | null
  /** Bytes downloaded so far. */
  current: number
  /** Total bytes, or 0 when the server did not report a length. */
  total: number
}

/**
 * Progress for a saved project's video being pulled down from R2 after the user
 * opens it. Opening keeps the picker mounted, so this corner widget is what
 * tells the user the editor is fetching media rather than stuck.
 */
export function DraftDownloadProgress({
  download,
}: {
  download: DraftDownloadState | null
}) {
  const eta = useTransferEta(
    download !== null,
    download?.current ?? 0,
    download?.total ?? 0
  )

  // Rendered only after a client-side open, so the portal never runs on the server.
  if (!download) return null

  const { name, current, total } = download
  const hasTotal = total > 0
  const title = name ? `Opening “${name}”` : "Downloading video"
  const sizeLine = hasTotal
    ? `${formatBytes(current)} / ${formatBytes(total)}`
    : `${formatBytes(current)} downloaded`

  return (
    <CornerProgressCard
      icon={<RiDownloadCloud2Line className="size-4 animate-pulse" />}
      title={title}
      detail={eta ? `${sizeLine} · ${eta}` : sizeLine}
      percent={
        hasTotal ? Math.min(100, Math.round((current / total) * 100)) : null
      }
    />
  )
}
