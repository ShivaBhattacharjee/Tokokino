import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_GIF_TOTAL_PIXELS,
  canRemuxAudioCodec,
  canvasIsVideoMedia,
  exportAudioDurationSec,
  gifExportExceedsMemory,
  measureVideoRegion,
  planFrames,
  preferredAudioCodecs,
  resolveAudioMuxStrategy,
  seekTo,
  shouldIncludeAudioPacket,
} from "@/lib/editor/animation-export/video-media"
import { AnimationExportAbortedError } from "@/lib/editor/animation-export/utils"
import { useEditorStore } from "@/lib/editor/store"
import { Mp4OutputFormat, WebMOutputFormat } from "mediabunny"

/**
 * Minimal fake <video> that tracks listener counts, so we can assert seekTo
 * detaches everything it attaches (no leaks / double-settles). jsdom's
 * HTMLVideoElement never fires seeked/error on its own, so we dispatch manually.
 */
class FakeVideo extends EventTarget {
  currentTime = 0
  constructor(public duration = 10) {
    super()
  }
  private counts = new Map<string, number>()
  addEventListener(type: string, ...rest: [never, never]) {
    this.counts.set(type, (this.counts.get(type) ?? 0) + 1)
    super.addEventListener(type, ...rest)
  }
  removeEventListener(type: string, ...rest: [never, never]) {
    this.counts.set(type, (this.counts.get(type) ?? 0) - 1)
    super.removeEventListener(type, ...rest)
  }
  listenerCount(type: string) {
    return this.counts.get(type) ?? 0
  }
}

const asVideo = (v: FakeVideo) => v as unknown as HTMLVideoElement

describe("planFrames — exact fps, no drop", () => {
  it("honors the chosen fps with a constant 1/fps cadence", () => {
    const plan = planFrames(2, 30)
    expect(plan.frameCount).toBe(60)
    expect(plan.frameDurationSec).toBeCloseTo(1 / 30, 10)
    expect(plan.timeForFrame(0)).toBe(0)
    expect(plan.timeForFrame(30)).toBeCloseTo(1, 10)
    expect(plan.timeForFrame(59)).toBeCloseTo(59 / 30, 10)
  })

  it("keeps 1/fps cadence for short clips (no fps thinning)", () => {
    // The regression this guards: a short clip must not stretch frames.
    const plan = planFrames(0.5, 30)
    expect(plan.frameCount).toBe(15)
    expect(plan.frameDurationSec).toBeCloseTo(1 / 30, 10)
  })

  it("rounds fractional frame counts and clamps to at least one frame", () => {
    expect(planFrames(1.5, 30).frameCount).toBe(45)
    expect(planFrames(0.001, 1).frameCount).toBe(1)
  })

  it("renders the full length of a long clip — no arbitrary truncation", () => {
    // 20 minutes at 60fps → all 72,000 frames, not silently cut off.
    const plan = planFrames(20 * 60, 60)
    expect(plan.frameCount).toBe(20 * 60 * 60)
    expect(plan.frameDurationSec).toBeCloseTo(1 / 60, 10)
    expect(plan.timeForFrame(plan.frameCount - 1)).toBeCloseTo(
      (plan.frameCount - 1) / 60,
      6
    )
  })

  it("guards a non-finite duration to a single frame (no runaway loop)", () => {
    expect(planFrames(Infinity, 30).frameCount).toBe(1)
    expect(planFrames(NaN, 30).frameCount).toBe(1)
  })
})

describe("preferredAudioCodecs / canRemuxAudioCodec — audio mux strategy", () => {
  it("prefers AAC for MP4 and Opus for WebM when re-encoding", () => {
    expect(preferredAudioCodecs("mp4")).toEqual(["aac", "mp3"])
    expect(preferredAudioCodecs("webm")).toEqual(["opus", "vorbis"])
  })

  it("remuxes when the source codec is in the container's supported set", () => {
    expect(canRemuxAudioCodec("aac", ["aac", "mp3"])).toBe(true)
    expect(canRemuxAudioCodec("opus", ["opus", "vorbis"])).toBe(true)
  })

  it("forces re-encode when the container can't take the source codec", () => {
    // Classic cross-format case: AAC source exported as WebM.
    expect(canRemuxAudioCodec("aac", ["opus", "vorbis"])).toBe(false)
    expect(canRemuxAudioCodec("opus", ["aac", "mp3"])).toBe(false)
  })

  it("preferred re-encode codecs are actually supported by mediabunny containers", () => {
    const mp4 = new Mp4OutputFormat().getSupportedAudioCodecs()
    const webm = new WebMOutputFormat().getSupportedAudioCodecs()
    for (const codec of preferredAudioCodecs("mp4")) {
      expect(mp4).toContain(codec)
    }
    for (const codec of preferredAudioCodecs("webm")) {
      expect(webm).toContain(codec)
    }
  })
})

describe("resolveAudioMuxStrategy — remux / re-encode / skip", () => {
  const mp4Supported = ["aac", "mp3", "opus"] as const
  const webmSupported = ["opus", "vorbis"] as const

  it("skips when there is no source codec", () => {
    expect(resolveAudioMuxStrategy(null, "mp4", mp4Supported, true)).toEqual({
      kind: "skip",
    })
  })

  it("remuxes AAC into MP4 without needing decode", () => {
    expect(resolveAudioMuxStrategy("aac", "mp4", mp4Supported, false)).toEqual({
      kind: "remux",
      codec: "aac",
    })
  })

  it("remuxes Opus into WebM", () => {
    expect(
      resolveAudioMuxStrategy("opus", "webm", webmSupported, false)
    ).toEqual({ kind: "remux", codec: "opus" })
  })

  it("re-encodes AAC → WebM to Opus/Vorbis when decode is available", () => {
    expect(resolveAudioMuxStrategy("aac", "webm", webmSupported, true)).toEqual(
      { kind: "reencode", candidates: ["opus", "vorbis"] }
    )
  })

  it("skips when re-encode is required but the track can't be decoded", () => {
    expect(
      resolveAudioMuxStrategy("aac", "webm", webmSupported, false)
    ).toEqual({ kind: "skip" })
  })

  it("skips when no preferred re-encode codec is container-supported", () => {
    // Hypothetical container that accepts neither Opus nor Vorbis.
    expect(
      resolveAudioMuxStrategy("aac", "webm", ["flac"] as const, true)
    ).toEqual({ kind: "skip" })
  })
})

describe("shouldIncludeAudioPacket / exportAudioDurationSec — trim + align", () => {
  it("includes packets that start before the export end", () => {
    expect(shouldIncludeAudioPacket(0, 2)).toBe(true)
    expect(shouldIncludeAudioPacket(1.999, 2)).toBe(true)
  })

  it("drops packets that start at or after the export end", () => {
    expect(shouldIncludeAudioPacket(2, 2)).toBe(false)
    expect(shouldIncludeAudioPacket(2.5, 2)).toBe(false)
  })

  it("drops negative timestamps (AAC priming / edit-list delay)", () => {
    // Exact class of failure from a real 7s MP4 export: muxer rejects -0.0885s.
    expect(shouldIncludeAudioPacket(-0.0885, 7)).toBe(false)
    expect(shouldIncludeAudioPacket(-0.00002, 7)).toBe(false)
  })

  it("treats a non-positive duration as empty (drop everything)", () => {
    expect(shouldIncludeAudioPacket(0, 0)).toBe(false)
    expect(shouldIncludeAudioPacket(0, -1)).toBe(false)
  })

  it("matches audio length to the planned video track (frameCount / fps)", () => {
    const plan = planFrames(2, 30)
    expect(exportAudioDurationSec(plan)).toBeCloseTo(2, 10)
    expect(exportAudioDurationSec(plan)).toBe(
      plan.frameCount * plan.frameDurationSec
    )
  })

  it("keeps audio aligned after fps rounding on a fractional clip", () => {
    // 1.5s @ 30fps → 45 frames → exactly 1.5s of audio, not the raw duration
    // with floating error from an alternate formula.
    const plan = planFrames(1.5, 30)
    expect(exportAudioDurationSec(plan)).toBeCloseTo(1.5, 10)
  })
})

describe("seekTo — resolves, and can't hang", () => {
  it("resolves once the seek completes and detaches its listeners", async () => {
    const v = new FakeVideo(10)
    const p = seekTo(asVideo(v), 5)
    expect(v.currentTime).toBe(5)
    v.dispatchEvent(new Event("seeked"))
    await expect(p).resolves.toBeUndefined()
    expect(v.listenerCount("seeked")).toBe(0)
    expect(v.listenerCount("error")).toBe(0)
  })

  it("resolves immediately when already at the target time", async () => {
    const v = new FakeVideo(10)
    v.currentTime = 5
    await expect(seekTo(asVideo(v), 5)).resolves.toBeUndefined()
    // No listeners attached at all on the fast path.
    expect(v.listenerCount("seeked")).toBe(0)
  })

  it("clamps the target time into the clip's range", async () => {
    const v = new FakeVideo(10)
    const p = seekTo(asVideo(v), 999)
    expect(v.currentTime).toBeLessThan(10)
    expect(v.currentTime).toBeGreaterThan(9.99)
    v.dispatchEvent(new Event("seeked"))
    await p
  })

  it("rejects on a decode error instead of hanging forever", async () => {
    const v = new FakeVideo(10)
    const p = seekTo(asVideo(v), 5)
    v.dispatchEvent(new Event("error"))
    await expect(p).rejects.toThrow("Video decode failed during seek")
    expect(v.listenerCount("seeked")).toBe(0)
    expect(v.listenerCount("error")).toBe(0)
  })

  it("rejects immediately when the signal is already aborted", async () => {
    const c = new AbortController()
    c.abort()
    await expect(seekTo(asVideo(new FakeVideo()), 5, c.signal)).rejects.toThrow(
      AnimationExportAbortedError
    )
  })

  it("rejects mid-seek when the export is aborted (Cancel is responsive)", async () => {
    const c = new AbortController()
    const v = new FakeVideo(10)
    const p = seekTo(asVideo(v), 5, c.signal)
    c.abort()
    await expect(p).rejects.toThrow(AnimationExportAbortedError)
    expect(v.listenerCount("seeked")).toBe(0)
    expect(v.listenerCount("error")).toBe(0)
  })
})

describe("gifExportExceedsMemory — guards against OOM", () => {
  it("allows a short, typical-resolution clip", () => {
    // ~10s at 30fps, 1080x608 ≈ 197M px — well under the cap.
    expect(gifExportExceedsMemory(300, 1080, 608)).toBe(false)
  })

  it("blocks a long clip that would balloon gifenc's in-memory buffer", () => {
    // ~60s at 30fps, 1080x608 ≈ 1.18B px — would reach hundreds of MB.
    expect(gifExportExceedsMemory(1800, 1080, 608)).toBe(true)
  })

  it("blocks a short but very high-resolution clip", () => {
    // Only 60 frames, but 4K each — area, not just length, drives memory.
    expect(gifExportExceedsMemory(60, 3840, 2160)).toBe(true)
  })

  it("sits right at the boundary", () => {
    expect(gifExportExceedsMemory(MAX_GIF_TOTAL_PIXELS, 1, 1)).toBe(false)
    expect(gifExportExceedsMemory(MAX_GIF_TOTAL_PIXELS + 1, 1, 1)).toBe(true)
  })
})

describe("measureVideoRegion — object-fit → composite geometry", () => {
  type Rect = { left: number; top: number; width: number; height: number }
  type FakeStyle = Partial<{
    objectFit: string
    objectPosition: string
    overflowX: string
    borderTopLeftRadius: string
    borderTopRightRadius: string
    borderBottomRightRadius: string
    borderBottomLeftRadius: string
  }>

  const styles = new Map<Element, FakeStyle>()

  const setRect = (el: HTMLElement, r: Rect) => {
    el.getBoundingClientRect = () => ({
      ...r,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON: () => "",
    })
  }

  const fakeStyle = (overrides: FakeStyle): FakeStyle => ({
    objectFit: "fill",
    objectPosition: "50% 50%",
    overflowX: "visible",
    borderTopLeftRadius: "0px",
    borderTopRightRadius: "0px",
    borderBottomRightRadius: "0px",
    borderBottomLeftRadius: "0px",
    ...overrides,
  })

  /** root(1000×800 at 0,0) > shell(overflow hidden, 800×450 at 100,100) > video */
  const buildScene = ({
    naturalW,
    naturalH,
    fit,
    videoRect,
    shellRadius = "0px",
  }: {
    naturalW: number
    naturalH: number
    fit: string
    videoRect?: Rect
    shellRadius?: string
  }) => {
    const root = document.createElement("div")
    const shell = document.createElement("div")
    const video = document.createElement("video")
    shell.appendChild(video)
    root.appendChild(shell)
    setRect(root, { left: 0, top: 0, width: 1000, height: 800 })
    setRect(shell, { left: 100, top: 100, width: 800, height: 450 })
    setRect(
      video,
      videoRect ?? { left: 100, top: 100, width: 800, height: 450 }
    )
    Object.defineProperty(video, "videoWidth", { value: naturalW })
    Object.defineProperty(video, "videoHeight", { value: naturalH })
    styles.set(video, fakeStyle({ objectFit: fit }))
    styles.set(
      shell,
      fakeStyle({
        overflowX: "hidden",
        borderTopLeftRadius: shellRadius,
        borderTopRightRadius: shellRadius,
        borderBottomRightRadius: shellRadius,
        borderBottomLeftRadius: shellRadius,
      })
    )
    return { root, video }
  }

  beforeEach(() => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el) => (styles.get(el) ?? fakeStyle({})) as CSSStyleDeclaration
    )
  })

  afterEach(() => {
    styles.clear()
    vi.restoreAllMocks()
  })

  it("fill + crop polyfill: oversized video clipped by the shell", () => {
    // Crop polyfill: object-fit fill, video box 2× the shell, offset so the
    // shell shows the video's center-ish region.
    const { root, video } = buildScene({
      naturalW: 1600,
      naturalH: 900,
      fit: "fill",
      videoRect: { left: -300, top: -125, width: 1600, height: 900 },
    })
    const region = measureVideoRegion(root, video)
    expect(region).not.toBeNull()
    expect(region).toMatchObject({
      destX: 100,
      destY: 100,
      destW: 800,
      destH: 450,
    })
    expect(region!.srcXFrac).toBeCloseTo(400 / 1600, 10)
    expect(region!.srcYFrac).toBeCloseTo(225 / 900, 10)
    expect(region!.srcWFrac).toBeCloseTo(0.5, 10)
    expect(region!.srcHFrac).toBeCloseTo(0.5, 10)
  })

  it("cover: crops the source, fills the whole box (uncropped Safari path)", () => {
    // Square 400×400 frame covering a 800×450 box → content is 800×800
    // centered, so the top/bottom of the source are cropped away.
    const { root, video } = buildScene({
      naturalW: 400,
      naturalH: 400,
      fit: "cover",
    })
    const region = measureVideoRegion(root, video)
    expect(region).not.toBeNull()
    expect(region).toMatchObject({
      destX: 100,
      destY: 100,
      destW: 800,
      destH: 450,
    })
    expect(region!.srcXFrac).toBeCloseTo(0, 10)
    expect(region!.srcWFrac).toBeCloseTo(1, 10)
    expect(region!.srcYFrac).toBeCloseTo(175 / 800, 10)
    expect(region!.srcHFrac).toBeCloseTo(450 / 800, 10)
  })

  it("contain: letterboxes — dest shrinks to the content, source is whole frame", () => {
    // Square 400×400 frame contained in a 800×450 box → content 450×450
    // centered horizontally; the letterbox bands stay template pixels.
    const { root, video } = buildScene({
      naturalW: 400,
      naturalH: 400,
      fit: "contain",
    })
    const region = measureVideoRegion(root, video)
    expect(region).not.toBeNull()
    expect(region!.destX).toBeCloseTo(275, 6)
    expect(region!.destY).toBeCloseTo(100, 6)
    expect(region!.destW).toBeCloseTo(450, 6)
    expect(region!.destH).toBeCloseTo(450, 6)
    expect(region!.srcXFrac).toBeCloseTo(0, 10)
    expect(region!.srcYFrac).toBeCloseTo(0, 10)
    expect(region!.srcWFrac).toBeCloseTo(1, 10)
    expect(region!.srcHFrac).toBeCloseTo(1, 10)
  })

  it("carries the shell's rounded-corner clip box", () => {
    const { root, video } = buildScene({
      naturalW: 1600,
      naturalH: 900,
      fit: "cover",
      shellRadius: "24px",
    })
    const region = measureVideoRegion(root, video)
    expect(region?.clip).toEqual({
      x: 100,
      y: 100,
      w: 800,
      h: 450,
      radii: [24, 24, 24, 24],
    })
  })

  it("omits the clip box for square shells", () => {
    const { root, video } = buildScene({
      naturalW: 1600,
      naturalH: 900,
      fit: "cover",
    })
    expect(measureVideoRegion(root, video)?.clip).toBeNull()
  })

  it("returns null before video metadata (0×0 natural size)", () => {
    const { root, video } = buildScene({
      naturalW: 0,
      naturalH: 0,
      fit: "cover",
    })
    expect(measureVideoRegion(root, video)).toBeNull()
  })
})

describe("canvasIsVideoMedia", () => {
  beforeEach(() => useEditorStore.getState().reset())

  const activeId = () => useEditorStore.getState().present.activeCanvasId

  it("is true when the active canvas's screenshot is a video", () => {
    useEditorStore.getState().setScreenshot("data:video/mp4;base64,AAAA")
    expect(canvasIsVideoMedia(activeId())).toBe(true)
  })

  it("is false for an image screenshot", () => {
    useEditorStore.getState().setScreenshot("data:image/png;base64,AAAA")
    expect(canvasIsVideoMedia(activeId())).toBe(false)
  })

  it("is false when there is no screenshot", () => {
    expect(canvasIsVideoMedia(activeId())).toBe(false)
  })

  it("is false for an unknown canvas id", () => {
    expect(canvasIsVideoMedia("does-not-exist")).toBe(false)
  })
})
