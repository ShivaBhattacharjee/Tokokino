/**
 * Editor video mute preference (localStorage only).
 *
 * Default is muted for browser autoplay policy. Toggle remembers across reloads
 * on this device — no account/DB sync needed.
 */

export const VIDEO_MUTED_STORAGE_KEY = "tokokino:video-muted"
export const DEFAULT_VIDEO_MUTED = true

function readStored(): boolean | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(VIDEO_MUTED_STORAGE_KEY)
    if (raw === "1" || raw === "true") return true
    if (raw === "0" || raw === "false") return false
  } catch {
    /* private mode / blocked storage */
  }
  return null
}

/** Sync read — prefers localStorage, else muted default. */
export function getVideoMutedPreferenceSync(): boolean {
  return readStored() ?? DEFAULT_VIDEO_MUTED
}

export function setVideoMutedPreference(muted: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(VIDEO_MUTED_STORAGE_KEY, muted ? "1" : "0")
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Apply mute preference to every registered video element. */
export function applyVideoMutedToAll(
  videos: Record<string, HTMLVideoElement>,
  muted = getVideoMutedPreferenceSync()
) {
  for (const el of Object.values(videos)) {
    el.muted = muted
  }
}
