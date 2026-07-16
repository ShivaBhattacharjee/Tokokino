/**
 * Video/animation export debug logger.
 *
 * Captures structured logs for a single export run, then persists them to
 * `debug/video-export/` via `/api/dev/export-debug` (local `pnpm dev`), with
 * a JSON download fallback when the API is unavailable.
 *
 * Enable:
 *  - always in development (`NODE_ENV === "development"`)
 *  - or `localStorage.setItem("tokokino:export-debug", "1")`
 *  - or URL `?exportDebug=1`
 */

import type { CanvasState } from "../state-types"

export type ExportDebugKind = "video-media" | "animation"

export type ExportDebugLevel = "debug" | "info" | "warn" | "error"

export type ExportDebugEntry = {
  t: number
  level: ExportDebugLevel
  tag: string
  message: string
  data?: unknown
}

export type FrameSampleStats = {
  width: number
  height: number
  sampleCount: number
  meanR: number
  meanG: number
  meanB: number
  meanA: number
  nonBlackPct: number
  fullyTransparentPct: number
  likelyBlack: boolean
  likelyBlank: boolean
}

export type ExportDebugPayload = {
  sessionId: string
  kind: ExportDebugKind
  status: "success" | "error" | "aborted"
  startedAt: string
  finishedAt: string
  durationMs: number
  meta: Record<string, unknown>
  entries: ExportDebugEntry[]
  /**
   * PNG data URLs of individual composite layers, written next to the JSON as
   * files. Every geometry number in this log is measured on the export clone,
   * so a clone that is itself wrong reads as perfectly self-consistent — the
   * only way past that is to look at the actual pixels of each layer.
   */
  layers?: Record<string, string>
  error?: { name: string; message: string; stack?: string }
}

const STORAGE_KEY = "tokokino:export-debug"
const CONSOLE_PREFIX = "[export-debug]"

let activeSession: ExportDebugSession | null = null

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

function safeJsonClone<T>(value: T): T | string {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return String(value)
  }
}

function errPayload(err: unknown): {
  name: string
  message: string
  stack?: string
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }
  return { name: "UnknownError", message: String(err) }
}

/** Collect browser/engine facts useful for Safari/WebKit filter bugs. */
export function collectBrowserMeta(): Record<string, unknown> {
  if (typeof navigator === "undefined") {
    return { env: "non-browser" }
  }
  const ua = navigator.userAgent
  const isSafari =
    /Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)
  const isFirefox = /Firefox\//i.test(ua) || /FxiOS\//i.test(ua)
  const isWebKit =
    /AppleWebKit\//i.test(ua) &&
    !/Chrome\//i.test(ua) &&
    !/Chromium\//i.test(ua)
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  let objectViewBox = false
  try {
    objectViewBox =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("object-view-box", "inset(0%)")
  } catch {
    objectViewBox = false
  }

  return {
    userAgent: ua,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    isSafari,
    isFirefox,
    isWebKit,
    isIos,
    supportsObjectViewBox: objectViewBox,
    videoEncoder: typeof VideoEncoder !== "undefined",
    videoDecoder: typeof VideoDecoder !== "undefined",
    mediaRecorder: typeof MediaRecorder !== "undefined",
    devicePixelRatio:
      typeof window !== "undefined" ? window.devicePixelRatio : null,
    screen:
      typeof screen !== "undefined"
        ? { width: screen.width, height: screen.height }
        : null,
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : null,
  }
}

/** Snapshot of canvas style props that commonly break Safari export. */
export function collectCanvasStyleSnapshot(
  canvas: CanvasState
): Record<string, unknown> {
  return {
    id: canvas.id,
    hasScreenshot: !!canvas.screenshot,
    screenshotKind: canvas.screenshot
      ? canvas.screenshot.startsWith("blob:")
        ? "blob"
        : canvas.screenshot.startsWith("data:")
          ? "data"
          : "url"
      : null,
    background: canvas.background,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    canvasBorderRadius: canvas.canvasBorderRadius,
    border: canvas.border,
    tilt: canvas.tilt,
    scale: canvas.scale,
    shadow: canvas.shadow,
    overlay: canvas.overlay,
    frame: canvas.frame,
    portrait: canvas.portrait,
    enhance: canvas.enhance,
    objectFit: canvas.objectFit,
    screenshotLayer: canvas.screenshotLayer,
    backdrop: canvas.backdrop,
    animationClipCount: canvas.animation?.clips?.length ?? 0,
    videoClipCount: canvas.videoClips?.length ?? 0,
    screenshotSlotCount: canvas.screenshotSlots?.length ?? 0,
    textCount: canvas.texts?.length ?? 0,
    assetCount: canvas.assets?.length ?? 0,
  }
}

/**
 * Sample sparse pixel stats from a canvas to detect black/blank/corrupt frames
 * (the typical Safari filter/foreignObject failure mode).
 */
export function sampleFrameStats(
  source: CanvasImageSource | HTMLCanvasElement | null | undefined,
  label?: string
): FrameSampleStats | null {
  if (!source) return null
  try {
    const width =
      "width" in source && typeof source.width === "number"
        ? source.width
        : "videoWidth" in source
          ? Number((source as { videoWidth: number }).videoWidth)
          : 0
    const height =
      "height" in source && typeof source.height === "number"
        ? source.height
        : "videoHeight" in source
          ? Number((source as { videoHeight: number }).videoHeight)
          : 0
    if (!width || !height) {
      return {
        width: 0,
        height: 0,
        sampleCount: 0,
        meanR: 0,
        meanG: 0,
        meanB: 0,
        meanA: 0,
        nonBlackPct: 0,
        fullyTransparentPct: 100,
        likelyBlack: true,
        likelyBlank: true,
      }
    }

    const probe = document.createElement("canvas")
    // Downsample so sampling stays cheap even at 4K.
    const maxEdge = 64
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    probe.width = Math.max(1, Math.round(width * scale))
    probe.height = Math.max(1, Math.round(height * scale))
    const ctx = probe.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, probe.width, probe.height)
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height)

    let r = 0
    let g = 0
    let b = 0
    let a = 0
    let nonBlack = 0
    let transparent = 0
    const pixels = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i] ?? 0
      const pg = data[i + 1] ?? 0
      const pb = data[i + 2] ?? 0
      const pa = data[i + 3] ?? 0
      r += pr
      g += pg
      b += pb
      a += pa
      if (pa < 8) transparent++
      else if (pr > 8 || pg > 8 || pb > 8) nonBlack++
    }

    const meanR = r / pixels
    const meanG = g / pixels
    const meanB = b / pixels
    const meanA = a / pixels
    const nonBlackPct = (nonBlack / pixels) * 100
    const fullyTransparentPct = (transparent / pixels) * 100
    const likelyBlank = fullyTransparentPct > 95 || pixels === 0
    const likelyBlack =
      !likelyBlank && nonBlackPct < 2 && meanR < 8 && meanG < 8 && meanB < 8

    const stats: FrameSampleStats = {
      width,
      height,
      sampleCount: pixels,
      meanR: Math.round(meanR * 10) / 10,
      meanG: Math.round(meanG * 10) / 10,
      meanB: Math.round(meanB * 10) / 10,
      meanA: Math.round(meanA * 10) / 10,
      nonBlackPct: Math.round(nonBlackPct * 100) / 100,
      fullyTransparentPct: Math.round(fullyTransparentPct * 100) / 100,
      likelyBlack,
      likelyBlank,
    }
    if (label) {
      // label is only for call-site context; stats object stays pure
      void label
    }
    return stats
  } catch {
    return null
  }
}

type FilterHit = {
  tag: string
  id?: string | null
  className?: string
  dataAttrs: Record<string, string>
  filter: string
  webkitFilter: string
  backdropFilter: string
  webkitBackdropFilter: string
  boxShadow: string
  opacity: string
  mixBlendMode: string
  maskImage: string
  webkitMaskImage: string
  transform: string
  inlineFilter?: string
  inlineWebkitFilter?: string
}

/** Walk the clone for elements whose filter/backdrop-filter/shadow may break WebKit. */
export function collectCloneFilterHits(
  root: HTMLElement,
  limit = 80
): FilterHit[] {
  const hits: FilterHit[] = []
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]
  for (const el of nodes) {
    if (hits.length >= limit) break
    let cs: CSSStyleDeclaration
    try {
      cs = getComputedStyle(el)
    } catch {
      continue
    }
    const filter = cs.filter || "none"
    const webkitFilter =
      (cs as CSSStyleDeclaration & { webkitFilter?: string }).webkitFilter ||
      cs.getPropertyValue("-webkit-filter") ||
      "none"
    const backdropFilter = cs.backdropFilter || "none"
    const webkitBackdropFilter =
      cs.getPropertyValue("-webkit-backdrop-filter") || "none"
    const boxShadow = cs.boxShadow || "none"
    const maskImage = cs.maskImage || "none"
    const webkitMaskImage = cs.getPropertyValue("-webkit-mask-image") || "none"
    const transform = cs.transform || "none"
    const opacity = cs.opacity || "1"
    const mixBlendMode = cs.mixBlendMode || "normal"
    const inlineFilter = el.style.filter || undefined
    const inlineWebkitFilter =
      el.style.getPropertyValue("-webkit-filter") || undefined

    const interesting =
      (filter && filter !== "none") ||
      (webkitFilter && webkitFilter !== "none") ||
      (backdropFilter && backdropFilter !== "none") ||
      (webkitBackdropFilter && webkitBackdropFilter !== "none") ||
      (boxShadow && boxShadow !== "none") ||
      (maskImage && maskImage !== "none") ||
      (webkitMaskImage && webkitMaskImage !== "none") ||
      (transform && transform !== "none") ||
      (mixBlendMode && mixBlendMode !== "normal") ||
      !!inlineFilter ||
      !!inlineWebkitFilter ||
      el.hasAttribute("data-editor-shadow-filter-target") ||
      el.hasAttribute("data-editor-shadow-box-target") ||
      el.hasAttribute("data-export-portrait-fx") ||
      el.tagName === "VIDEO" ||
      el.tagName === "CANVAS" ||
      el.tagName === "IMG"

    if (!interesting) continue

    const dataAttrs: Record<string, string> = {}
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-")) dataAttrs[attr.name] = attr.value
    }

    hits.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className:
        typeof el.className === "string"
          ? el.className.slice(0, 200)
          : undefined,
      dataAttrs,
      filter,
      webkitFilter,
      backdropFilter,
      webkitBackdropFilter,
      boxShadow: boxShadow.slice(0, 300),
      opacity,
      mixBlendMode,
      maskImage: maskImage.slice(0, 200),
      webkitMaskImage: webkitMaskImage.slice(0, 200),
      transform: transform.slice(0, 200),
      inlineFilter,
      inlineWebkitFilter,
    })
  }
  return hits
}

export function isExportDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true
    if (localStorage.getItem(STORAGE_KEY) === "0") return false
  } catch {
    // private mode
  }
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get("exportDebug") === "1") return true
    if (params.get("exportDebug") === "0") return false
  } catch {
    // ignore
  }
  return process.env.NODE_ENV === "development"
}

export function getActiveExportDebug(): ExportDebugSession | null {
  return activeSession
}

export class ExportDebugSession {
  readonly sessionId: string
  readonly kind: ExportDebugKind
  readonly startedAt: string
  private readonly t0: number
  private readonly entries: ExportDebugEntry[] = []
  private readonly meta: Record<string, unknown> = {}
  private finished = false
  private frameSampleBudget = 24
  private slowFrameThresholdMs = 250
  private readonly layers: Record<string, string> = {}

  constructor(kind: ExportDebugKind, canvasId: string) {
    this.sessionId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    this.kind = kind
    this.startedAt = new Date().toISOString()
    this.t0 = nowMs()
    this.meta.canvasId = canvasId
    this.meta.browser = collectBrowserMeta()
    this.info("session", "export debug session started", {
      kind,
      canvasId,
      sessionId: this.sessionId,
    })
  }

  setMeta(key: string, value: unknown) {
    this.meta[key] = safeJsonClone(value)
  }

  mergeMeta(patch: Record<string, unknown>) {
    for (const [k, v] of Object.entries(patch)) {
      this.meta[k] = safeJsonClone(v)
    }
  }

  log(level: ExportDebugLevel, tag: string, message: string, data?: unknown) {
    if (this.finished) return
    const entry: ExportDebugEntry = {
      t: Math.round((nowMs() - this.t0) * 10) / 10,
      level,
      tag,
      message,
    }
    if (data !== undefined) entry.data = safeJsonClone(data)
    this.entries.push(entry)

    const line = `${CONSOLE_PREFIX} [${this.kind}] ${tag}: ${message}`
    if (level === "error") console.error(line, data ?? "")
    else if (level === "warn") console.warn(line, data ?? "")
    else if (level === "debug") console.debug(line, data ?? "")
    else console.info(line, data ?? "")
  }

  debug(tag: string, message: string, data?: unknown) {
    this.log("debug", tag, message, data)
  }
  info(tag: string, message: string, data?: unknown) {
    this.log("info", tag, message, data)
  }
  warn(tag: string, message: string, data?: unknown) {
    this.log("warn", tag, message, data)
  }
  error(tag: string, message: string, data?: unknown) {
    this.log("error", tag, message, data)
  }

  /**
   * Log frame sample stats. Throttled: first few, last, every Nth, black/blank,
   * and frames that took too long.
   */
  logFrameSample(
    tag: string,
    frameIndex: number,
    frameCount: number,
    source: CanvasImageSource | HTMLCanvasElement | null | undefined,
    extra?: Record<string, unknown>
  ) {
    const elapsed = typeof extra?.durationMs === "number" ? extra.durationMs : 0
    const isBoundary =
      frameIndex < 3 ||
      frameIndex >= frameCount - 2 ||
      frameIndex % 10 === 0 ||
      elapsed >= this.slowFrameThresholdMs
    if (!isBoundary && this.frameSampleBudget <= 0) {
      if (extra && Object.keys(extra).length) {
        this.debug(tag, `frame ${frameIndex}/${frameCount}`, extra)
      }
      return
    }

    const stats = sampleFrameStats(source)
    if (stats?.likelyBlack || stats?.likelyBlank) {
      this.warn(tag, `frame ${frameIndex} looks empty/black`, {
        frameIndex,
        frameCount,
        stats,
        ...extra,
      })
      this.frameSampleBudget--
      return
    }
    if (isBoundary || this.frameSampleBudget > 0) {
      this.info(tag, `frame ${frameIndex}/${frameCount}`, {
        frameIndex,
        frameCount,
        stats,
        ...extra,
      })
      if (isBoundary) this.frameSampleBudget--
    }
  }

  logCloneFilters(root: HTMLElement, label = "clone-filters") {
    const hits = collectCloneFilterHits(root)
    this.info(label, `collected ${hits.length} filter/style hits on clone`, {
      count: hits.length,
      hits,
    })
  }

  /**
   * Store a PNG of one composite layer (underlay / foreground / first frame) so
   * the layers can be inspected side by side after the run. Dev-only and capped
   * — these are megabytes each.
   */
  addLayerSnapshot(name: string, canvas: HTMLCanvasElement) {
    if (this.finished) return
    if (Object.keys(this.layers).length >= 8) return
    if (!canvas.width || !canvas.height) return
    try {
      this.layers[name] = canvas.toDataURL("image/png")
      this.info("layer", `captured layer snapshot: ${name}`, {
        width: canvas.width,
        height: canvas.height,
      })
    } catch (err) {
      this.warn("layer", `layer snapshot failed: ${name}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async flush(
    status: "success" | "error" | "aborted",
    err?: unknown
  ): Promise<string | null> {
    if (this.finished) return null
    this.finished = true
    const finishedAt = new Date().toISOString()
    const durationMs = Math.round(nowMs() - this.t0)
    this.info("session", "export debug session finishing", {
      status,
      durationMs,
      entryCount: this.entries.length,
    })

    const payload: ExportDebugPayload = {
      sessionId: this.sessionId,
      kind: this.kind,
      status,
      startedAt: this.startedAt,
      finishedAt,
      durationMs,
      meta: this.meta,
      entries: this.entries,
    }
    if (Object.keys(this.layers).length > 0) payload.layers = this.layers
    if (err !== undefined) payload.error = errPayload(err)

    if (activeSession === this) activeSession = null

    let savedPath: string | null = null
    try {
      const res = await fetch("/api/dev/export-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const json: unknown = await res.json()
        if (
          json &&
          typeof json === "object" &&
          "path" in json &&
          typeof json.path === "string"
        ) {
          savedPath = json.path
        }
        console.info(
          `${CONSOLE_PREFIX} saved export log → ${savedPath ?? "(unknown path)"}`
        )
      } else {
        console.warn(
          `${CONSOLE_PREFIX} API save failed (${res.status}), downloading log instead`
        )
        downloadPayload(payload)
      }
    } catch (fetchErr) {
      console.warn(
        `${CONSOLE_PREFIX} API save unavailable, downloading log instead`,
        fetchErr
      )
      downloadPayload(payload)
    }
    return savedPath
  }
}

function downloadPayload(payload: ExportDebugPayload) {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tokokino-export-debug-${payload.kind}-${payload.sessionId}.json`
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch {
    // last resort — already printed to console
  }
}

export function startExportDebug(
  kind: ExportDebugKind,
  canvasId: string
): ExportDebugSession | null {
  if (!isExportDebugEnabled()) return null
  // End any orphaned session so logs don't interleave.
  if (activeSession) {
    void activeSession.flush("aborted", new Error("superseded by new export"))
  }
  const session = new ExportDebugSession(kind, canvasId)
  activeSession = session
  return session
}

/** Convenience: log if a session is active. Safe no-op otherwise. */
export function exportDebugLog(
  level: ExportDebugLevel,
  tag: string,
  message: string,
  data?: unknown
) {
  const s = activeSession
  if (!s) return
  s.log(level, tag, message, data)
}
