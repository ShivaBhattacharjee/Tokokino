"use client"

import { getBlobForObjectUrl, registerObjectUrl } from "@/lib/editor/media-type"
import { draftMediaIdFromUrl } from "@/lib/schemas/draft"

type VideoCanvas = {
  screenshot: string | null
  originalScreenshot: string | null
  background?: { type: string; value: string }
  screenshotSlots: Array<{ src: string | null }>
}

type VideoState = { canvases?: VideoCanvas[] }
export type DraftVideoUploadProgress = { current: number; total: number }
export type DraftVideoDownloadProgress = { current: number; total: number }

export function replaceUploadedDraftVideoSources<T extends VideoState>(
  state: T,
  uploaded: Map<string, string>
): T {
  const replace = (src: string | null) =>
    src ? (uploaded.get(src) ?? src) : src
  return {
    ...state,
    canvases: (state.canvases ?? []).map((canvas) => ({
      ...canvas,
      screenshot: replace(canvas.screenshot),
      originalScreenshot: replace(canvas.originalScreenshot),
      background:
        canvas.background?.type === "image"
          ? {
              ...canvas.background,
              value: replace(canvas.background.value) ?? "",
            }
          : canvas.background,
      screenshotSlots: canvas.screenshotSlots.map((slot) => ({
        ...slot,
        src: replace(slot.src),
      })),
    })),
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read image data"))
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image data"))
    reader.readAsDataURL(blob)
  })
}

/**
 * Imported screenshots and backgrounds persist as `data:` URLs, but restoring
 * the IndexedDB autosave re-mints them as `blob:` URLs, which only resolve in
 * the page session that created them. Videos escape this by being uploaded to
 * R2; images cannot, because the draft media endpoint takes MP4/WebM only. So
 * an image blob left in a saved draft is a reference that is already dead by
 * the time the draft is reopened — it loads as a broken image while the
 * thumbnail (a separate R2 upload) still looks correct.
 *
 * Inlining them back to data URLs before serializing restores exactly what a
 * freshly imported screenshot would have saved.
 */
export async function inlineDraftImageBlobs<T extends VideoState>(
  state: T
): Promise<T> {
  const sources = new Set<string>()
  const collect = (src: string | null | undefined) => {
    if (!src?.startsWith("blob:")) return
    const blob = getBlobForObjectUrl(src)
    if (blob && !blob.type.startsWith("video/")) sources.add(src)
  }

  for (const canvas of state.canvases ?? []) {
    collect(canvas.screenshot)
    collect(canvas.originalScreenshot)
    if (canvas.background?.type === "image") collect(canvas.background.value)
    for (const slot of canvas.screenshotSlots) collect(slot.src)
  }

  if (sources.size === 0) return state

  const inlined = new Map<string, string>()
  for (const src of sources) {
    const blob = getBlobForObjectUrl(src)
    if (blob) inlined.set(src, await blobToDataUrl(blob))
  }
  return replaceUploadedDraftVideoSources(state, inlined)
}

async function uploadDraftVideo(
  blob: Blob,
  onProgress: (loaded: number) => void
) {
  const contentType = blob.type.toLowerCase()
  if (contentType !== "video/mp4" && contentType !== "video/webm") {
    throw new Error("Draft videos must be MP4 or WebM")
  }
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("POST", "/api/drafts/media")
    request.withCredentials = true
    request.setRequestHeader("Content-Type", contentType)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded)
    }
    request.onerror = () => reject(new Error("Could not upload draft video"))
    request.onload = () => {
      const data = JSON.parse(request.responseText || "null") as {
        url?: string
        error?: string
      } | null
      if (request.status < 200 || request.status >= 300 || !data?.url) {
        reject(new Error(data?.error ?? "Could not upload draft video"))
        return
      }
      resolve(data.url)
    }
    request.send(blob)
  })
}

async function copyDraftVideo(src: string) {
  const id = draftMediaIdFromUrl(src)
  if (!id) throw new Error("Draft video is unavailable")
  const response = await fetch(`/api/drafts/media/${id}/copy`, {
    method: "POST",
    credentials: "include",
  })
  const data = (await response.json().catch(() => null)) as {
    url?: string
    error?: string
  } | null
  if (!response.ok || !data?.url)
    throw new Error(data?.error ?? "Could not copy draft video")
  return data.url
}

async function downloadDraftVideo(
  src: string,
  onProgress: (progress: DraftVideoDownloadProgress) => void,
  completed: number
) {
  return new Promise<Blob>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("GET", src)
    request.withCredentials = true
    request.responseType = "blob"
    request.onprogress = (event) => {
      onProgress({
        current: completed + event.loaded,
        total: event.lengthComputable ? completed + event.total : 0,
      })
    }
    request.onerror = () => reject(new Error("Could not download draft video"))
    request.onload = () => {
      const blob: unknown = request.response
      if (
        request.status < 200 ||
        request.status >= 300 ||
        !(blob instanceof Blob)
      ) {
        reject(new Error("Could not download draft video"))
        return
      }
      resolve(blob)
    }
    request.send()
  })
}

/**
 * Saved draft media lives in private R2 storage. Before loading a draft into
 * the editor, materialize every saved video as a local blob URL so playback
 * never depends on browser-controlled R2 range buffering.
 */
export async function downloadDraftVideos<T extends VideoState>(
  state: T,
  onProgress?: (progress: DraftVideoDownloadProgress) => void
): Promise<T> {
  const sources = new Set<string>()
  for (const canvas of state.canvases ?? []) {
    for (const src of [
      canvas.screenshot,
      canvas.originalScreenshot,
      ...canvas.screenshotSlots.map((slot) => slot.src),
    ]) {
      if (src && draftMediaIdFromUrl(src)) sources.add(src)
    }
  }

  if (sources.size === 0) return state

  let completed = 0
  const downloaded = new Map<string, string>()
  onProgress?.({ current: 0, total: 0 })
  for (const src of sources) {
    const blob = await downloadDraftVideo(
      src,
      (progress) => onProgress?.(progress),
      completed
    )
    completed += blob.size
    onProgress?.({ current: completed, total: completed })
    downloaded.set(src, registerObjectUrl(blob))
  }
  return replaceUploadedDraftVideoSources(state, downloaded)
}

export async function uploadDraftVideos<T extends VideoState>(
  state: T,
  onProgress?: (progress: DraftVideoUploadProgress) => void,
  copyExisting = false
): Promise<T> {
  const sources = new Set<string>()
  const existingSources = new Set<string>()
  for (const canvas of state.canvases ?? []) {
    for (const src of [
      canvas.screenshot,
      canvas.originalScreenshot,
      ...canvas.screenshotSlots.map((slot) => slot.src),
    ]) {
      if (
        src?.startsWith("blob:") &&
        getBlobForObjectUrl(src)?.type.startsWith("video/")
      )
        sources.add(src)
      if (copyExisting && typeof src === "string" && draftMediaIdFromUrl(src))
        existingSources.add(src)
    }
  }
  const videoBlobs = new Map<string, Blob>()
  for (const src of sources) {
    const blob = getBlobForObjectUrl(src)
    if (!blob)
      throw new Error(
        "Video source is no longer available. Add the video again before saving."
      )
    videoBlobs.set(src, blob)
  }
  const total = [...videoBlobs.values()].reduce(
    (sum, blob) => sum + blob.size,
    0
  )
  let completed = 0
  const uploaded = new Map<string, string>()

  if (total > 0) {
    onProgress?.({ current: 0, total })
  }

  for (const [src, blob] of videoBlobs) {
    uploaded.set(
      src,
      await uploadDraftVideo(blob, (loaded) =>
        onProgress?.({ current: completed + loaded, total })
      )
    )
    completed += blob.size
    onProgress?.({ current: completed, total })
  }
  for (const src of existingSources) {
    uploaded.set(src, await copyDraftVideo(src))
  }
  return replaceUploadedDraftVideoSources(state, uploaded)
}
