"use client"

export const SHARE_UPLOAD_PART_BYTES = 8 * 1024 * 1024

const DB_NAME = "tokokino-share-uploads"
const DB_VERSION = 1
const STORE = "uploads"
const MAX_RETRIES = 4

export type ShareUploadFormat = "mp4" | "webm" | "gif"
export type ShareUploadResolution = "hd" | "fullhd" | "4k"

export type PendingShareUpload = {
  id: string
  shareId: string
  canvasId: string
  signature: string
  mediaKind: "animate" | "video"
  format: ShareUploadFormat
  resolution: ShareUploadResolution
  contentType: "video/mp4" | "video/webm" | "image/gif"
  media: Blob
  poster: Blob | null
  sizeBytes: number
  createdAt: number
  updatedAt: number
}

export type ShareUploadProgress = {
  phase: "uploading"
  current: number
  total: number
  label: string
}

type ServerStatus = {
  id: string
  shareId: string
  status: "active" | "finalizing" | "complete" | "cancelled"
  sizeBytes: number
  confirmedBytes: number
  parts: number[]
  url: string | null
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open upload storage"))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      request.onerror = () =>
        reject(request.error ?? new Error("Upload storage request failed"))
      request.onsuccess = () => resolve(request.result)
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Upload storage transaction failed")
        )
    })
  } finally {
    db.close()
  }
}

export async function listPendingResumableShareUploads() {
  const records = await withStore("readonly", (store) => store.getAll())
  return (records as PendingShareUpload[]).sort(
    (a, b) => b.updatedAt - a.updatedAt
  )
}

async function savePendingUpload(upload: PendingShareUpload) {
  await withStore("readwrite", (store) => store.put(upload))
}

async function removePendingUpload(id: string) {
  await withStore("readwrite", (store) => store.delete(id))
}

async function getPendingUpload(id: string) {
  return (await withStore("readonly", (store) => store.get(id))) as
    | PendingShareUpload
    | undefined
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function retryDelay(attempt: number) {
  return Math.min(8_000, 500 * 2 ** attempt) + Math.round(Math.random() * 250)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function waitForOnline() {
  if (navigator.onLine) return Promise.resolve()
  return new Promise<void>((resolve) => {
    window.addEventListener("online", () => resolve(), { once: true })
  })
}

async function requestWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  onRetry?: (attempt: number) => void
) {
  let attempt = 0
  while (true) {
    await waitForOnline()
    try {
      const response = await fetch(input, { ...init, credentials: "include" })
      if (
        response.ok ||
        !isTransientStatus(response.status) ||
        attempt >= MAX_RETRIES
      ) {
        return response
      }
    } catch {
      if (attempt >= MAX_RETRIES)
        throw new Error("Connection failed while uploading")
    }
    onRetry?.(attempt + 1)
    await wait(retryDelay(attempt))
    attempt += 1
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null
}

function mediaContentType(
  format: ShareUploadFormat
): PendingShareUpload["contentType"] {
  if (format === "mp4") return "video/mp4"
  if (format === "webm") return "video/webm"
  return "image/gif"
}

export async function createResumableShareUpload(input: {
  canvasId: string
  signature: string
  mediaKind: "animate" | "video"
  format: ShareUploadFormat
  resolution: ShareUploadResolution
  media: Blob
  poster: Blob | null
  onProgress?: (progress: ShareUploadProgress) => void
}) {
  const contentType = mediaContentType(input.format)
  if (input.media.type && input.media.type !== contentType) {
    throw new Error("Encoded media type does not match selected format")
  }
  const response = await requestWithRetry("/api/share/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, sizeBytes: input.media.size }),
  })
  const created = await readJson<{
    id?: string
    shareId?: string
    error?: string
  }>(response)
  if (!response.ok || !created?.id || !created.shareId) {
    throw new Error(created?.error ?? "Could not start resumable upload")
  }
  const upload: PendingShareUpload = {
    id: created.id,
    shareId: created.shareId,
    canvasId: input.canvasId,
    signature: input.signature,
    mediaKind: input.mediaKind,
    format: input.format,
    resolution: input.resolution,
    contentType,
    media: input.media,
    poster: input.poster,
    sizeBytes: input.media.size,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  try {
    await savePendingUpload(upload)
  } catch (error) {
    await fetch(`/api/share/uploads/${upload.id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {})
    throw error
  }
  return resumeResumableShareUpload(upload, input.onProgress)
}

export async function resumeResumableShareUpload(
  pending: PendingShareUpload | string,
  onProgress?: (progress: ShareUploadProgress) => void
) {
  const upload =
    typeof pending === "string" ? await getPendingUpload(pending) : pending
  if (!upload) throw new Error("Saved upload is no longer available")
  if (upload.media.size !== upload.sizeBytes) {
    await cancelResumableShareUpload(upload.id)
    throw new Error(
      "Saved upload data is incomplete. Please create the share again."
    )
  }

  const statusResponse = await requestWithRetry(
    `/api/share/uploads/${upload.id}`,
    { method: "GET" }
  )
  const status = await readJson<ServerStatus & { error?: string }>(
    statusResponse
  )
  if (!statusResponse.ok || !status) {
    throw new Error(status?.error ?? "Could not recover upload")
  }
  if (status.status === "complete" && status.url) {
    await removePendingUpload(upload.id)
    return { url: status.url, shareId: status.shareId }
  }
  if (status.status !== "active" && status.status !== "finalizing") {
    throw new Error("This upload can no longer be resumed")
  }

  const confirmed = new Set(status.parts)
  let confirmedBytes = status.confirmedBytes
  const totalParts = Math.ceil(upload.sizeBytes / SHARE_UPLOAD_PART_BYTES)
  onProgress?.({
    phase: "uploading",
    current: confirmedBytes,
    total: upload.sizeBytes,
    label: "Resuming upload…",
  })

  if (status.status === "active") {
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      if (confirmed.has(partNumber)) continue
      const start = (partNumber - 1) * SHARE_UPLOAD_PART_BYTES
      const end = Math.min(upload.sizeBytes, start + SHARE_UPLOAD_PART_BYTES)
      const body = upload.media.slice(start, end, upload.contentType)
      const partResponse = await requestWithRetry(
        `/api/share/uploads/${upload.id}/parts/${partNumber}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": upload.contentType,
            "Content-Range": `bytes ${start}-${end - 1}/${upload.sizeBytes}`,
          },
          body,
        },
        (attempt) =>
          onProgress?.({
            phase: "uploading",
            current: confirmedBytes,
            total: upload.sizeBytes,
            label: `Retrying upload (attempt ${attempt})…`,
          })
      )
      const part = await readJson<{ confirmedBytes?: number; error?: string }>(
        partResponse
      )
      if (!partResponse.ok || typeof part?.confirmedBytes !== "number") {
        throw new Error(part?.error ?? "Could not upload video part")
      }
      confirmedBytes = part.confirmedBytes
      confirmed.add(partNumber)
      onProgress?.({
        phase: "uploading",
        current: confirmedBytes,
        total: upload.sizeBytes,
        label: "Uploading share…",
      })
    }
  }

  const completeResponse = await requestWithRetry(
    `/api/share/uploads/${upload.id}/complete`,
    {
      method: "POST",
    }
  )
  const completed = await readJson<{ url?: string; error?: string }>(
    completeResponse
  )
  if (!completeResponse.ok || !completed?.url) {
    throw new Error(completed?.error ?? "Could not complete upload")
  }

  if (upload.poster) {
    await requestWithRetry(`/api/share/uploads/${upload.id}/poster`, {
      method: "PUT",
      headers: { "Content-Type": upload.poster.type || "image/jpeg" },
      body: upload.poster,
    }).catch(() => {})
  }
  await removePendingUpload(upload.id)
  return { url: completed.url, shareId: upload.shareId }
}

export async function cancelResumableShareUpload(id: string) {
  await fetch(`/api/share/uploads/${id}`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {})
  await removePendingUpload(id)
}
