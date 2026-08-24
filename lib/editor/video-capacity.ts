"use client"

import { create } from "zustand"

// Assumed budget when the browser won't report a storage estimate. Chosen so
// the swap reserve still clears a ~3.5 GB import silently: a browser that hides
// its quota is unlikely to be comfortable much past that.
export const FALLBACK_FREE_BYTES = 8 * 1024 * 1024 * 1024

// A video swap puts the new blob and deletes the old one in a single IndexedDB
// transaction, so the disk transiently holds both copies — budget for two.
const SWAP_COPIES = 2

// Draft JSON, thumbnails and the other canvases' screenshots draw on the same
// origin budget as the video.
const DRAFT_OVERHEAD_BYTES = 1024 * 1024 * 1024

/** Room this import needs to still be replaceable by one of the same size. */
export function requiredBytesFor(fileBytes: number): number {
  return fileBytes * SWAP_COPIES + DRAFT_OVERHEAD_BYTES
}

export type VideoCapacityLevel = "ok" | "tight" | "over"

export type VideoCapacity = {
  level: VideoCapacityLevel
  fileBytes: number
  /** null when the browser gave no estimate and the fallback was used. */
  freeBytes: number | null
  /** False when the browser may evict this origin's drafts under disk pressure. */
  persisted: boolean
}

/**
 * Ask the browser to mark this origin's storage persistent. Without it the
 * origin is "best-effort" and everything — drafts, videos — can be evicted
 * wholesale under disk pressure. Chrome decides from engagement signals and
 * may refuse; Safari grants it on use. Never throws, never prompts twice.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false
  }
  try {
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

async function estimateFreeBytes(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null
  }
  try {
    const { quota, usage } = await navigator.storage.estimate()
    if (typeof quota !== "number" || !Number.isFinite(quota)) return null
    return Math.max(0, quota - (usage ?? 0))
  } catch {
    return null
  }
}

export async function measureVideoCapacity(
  fileBytes: number
): Promise<VideoCapacity> {
  const [freeBytes, persisted] = await Promise.all([
    estimateFreeBytes(),
    ensurePersistentStorage(),
  ])
  const budget = freeBytes ?? FALLBACK_FREE_BYTES
  if (fileBytes > budget) {
    return { level: "over", fileBytes, freeBytes, persisted }
  }
  if (requiredBytesFor(fileBytes) > budget) {
    return { level: "tight", fileBytes, freeBytes, persisted }
  }
  return { level: "ok", fileBytes, freeBytes, persisted }
}

type PendingPrompt = {
  capacity: VideoCapacity
  resolve: (proceed: boolean) => void
}

type VideoCapacityState = {
  pending: PendingPrompt | null
  resolvePending: (proceed: boolean) => void
}

export const useVideoCapacityPrompt = create<VideoCapacityState>(
  (set, get) => ({
    pending: null,
    resolvePending: (proceed) => {
      const pending = get().pending
      if (!pending) return
      set({ pending: null })
      pending.resolve(proceed)
    },
  })
)

/**
 * Resolves true when the import should go ahead. Playback and export stream
 * straight off the File, so an oversized video still edits fine — what it risks
 * is the draft autosave, which has to copy the bytes into IndexedDB. That's the
 * user's call to make, so ask rather than refuse.
 */
export async function confirmVideoImport(file: File): Promise<boolean> {
  const capacity = await measureVideoCapacity(file.size)
  if (capacity.level === "ok") return true
  return new Promise<boolean>((resolve) => {
    const state = useVideoCapacityPrompt.getState()
    state.pending?.resolve(false)
    useVideoCapacityPrompt.setState({ pending: { capacity, resolve } })
  })
}
