"use client"

import { RiHardDrive2Line } from "@remixicon/react"

import { CornerProgressCard } from "@/components/editor/corner-progress"
import type { OfflineProgress } from "@/lib/offline/offline-shell"

/**
 * Progress for "make available offline", in the same corner slot as
 * {@link DraftDownloadProgress}. Counts shell files rather than bytes — the
 * designs are already local, so only the editor's code is being fetched.
 */
export function OfflineProgressCard({
  progress,
}: {
  progress: OfflineProgress | null
}) {
  if (!progress) return null

  const { label, current, total } = progress
  const hasTotal = total > 0

  return (
    <CornerProgressCard
      icon={<RiHardDrive2Line className="size-4 animate-pulse" />}
      title="Making the editor available offline"
      detail={hasTotal ? `${label} ${current} / ${total} files` : label}
      percent={
        hasTotal ? Math.min(100, Math.round((current / total) * 100)) : null
      }
    />
  )
}
