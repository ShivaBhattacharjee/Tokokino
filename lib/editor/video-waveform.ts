"use client"

import * as React from "react"

import { getBlobForObjectUrl } from "./media-type"

// Audio peaks for the video base layer in the Animate timeline, drawn as an
// overlay across the filmstrip. Like the filmstrip, extraction is progressive
// (peaks fill in left to right) and cached per src for the session.

export type VideoWaveform = {
  /** Peak amplitude 0–1 per bucket, evenly spaced across the whole source. */
  peaks: number[]
  /** How many buckets the finished waveform will have. */
  bucketCount: number
  /** Track has no audio, or nothing this browser can decode. */
  silent: boolean
  done: boolean
}

// Resolution of the cached peaks. The timeline stretches them to whatever width
// the clip has, so this only has to beat the widest realistic zoom.
const BUCKETS = 900
// Repainting on every decoded packet is wasted work — batch progress instead.
const EMIT_EVERY_SAMPLES = 40

const entries = new Map<string, VideoWaveform>()
const listeners = new Map<string, Set<() => void>>()
const started = new Set<string>()

function emit(src: string) {
  const set = listeners.get(src)
  if (set) for (const listener of set) listener()
}

function setEntry(src: string, entry: VideoWaveform) {
  entries.set(src, entry)
  emit(src)
}

function subscribeTo(src: string, listener: () => void) {
  let set = listeners.get(src)
  if (!set) {
    set = new Set()
    listeners.set(src, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(src)
  }
}

async function blobFor(src: string): Promise<Blob | null> {
  const known = getBlobForObjectUrl(src)
  if (known) return known
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

async function extractWaveform(src: string): Promise<void> {
  const blob = await blobFor(src)
  if (!blob) {
    started.delete(src)
    return
  }

  const silent = () =>
    setEntry(src, { peaks: [], bucketCount: 0, silent: true, done: true })

  try {
    const { ALL_FORMATS, AudioSampleSink, BlobSource, Input } =
      await import("mediabunny")
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    })
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) {
      silent()
      return
    }
    const durationSec = await track.computeDuration()
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      silent()
      return
    }

    const sums = new Float32Array(BUCKETS)
    const counts = new Uint32Array(BUCKETS)
    setEntry(src, {
      peaks: [],
      bucketCount: BUCKETS,
      silent: false,
      done: false,
    })

    let scratch = new Float32Array(0)
    let loudest = 0
    let filled = 0
    let sinceEmit = 0

    const snapshot = () => {
      // Normalise against the loudest bucket seen so far, and only publish the
      // buckets decoding has actually reached so the overlay grows left to
      // right instead of drawing a flat tail.
      const peaks: number[] = []
      const scale = loudest > 0 ? 1 / loudest : 0
      for (let i = 0; i < filled; i++) {
        peaks.push(counts[i] > 0 ? Math.min(1, sums[i] * scale) : 0)
      }
      return peaks
    }

    const sink = new AudioSampleSink(track)
    for await (const sample of sink.samples()) {
      const frames = sample.numberOfFrames
      if (frames > scratch.length) scratch = new Float32Array(frames)
      // Channel 0 alone: a peak envelope doesn't need the stereo image, and
      // mixing channels would double the copies per packet.
      sample.copyTo(scratch.subarray(0, frames), {
        planeIndex: 0,
        format: "f32-planar",
      })
      const startFrac = sample.timestamp / durationSec
      const endFrac = (sample.timestamp + sample.duration) / durationSec
      for (let i = 0; i < frames; i++) {
        const frac = startFrac + ((endFrac - startFrac) * i) / frames
        const bucket = Math.floor(frac * BUCKETS)
        if (bucket < 0 || bucket >= BUCKETS) continue
        const amp = Math.abs(scratch[i])
        if (amp > sums[bucket]) sums[bucket] = amp
        counts[bucket] = 1
        if (bucket >= filled) filled = bucket + 1
        if (amp > loudest) loudest = amp
      }
      sample.close()

      if (++sinceEmit >= EMIT_EVERY_SAMPLES) {
        sinceEmit = 0
        const prev = entries.get(src)
        if (!prev) return
        setEntry(src, { ...prev, peaks: snapshot() })
      }
    }

    const peaks = snapshot()
    setEntry(src, {
      peaks,
      bucketCount: BUCKETS,
      // An all-zero track is silence — drawing a flat line just adds noise.
      silent: peaks.every((p) => p === 0),
      done: true,
    })
  } catch {
    silent()
  }
}

/**
 * Subscribe to the (possibly still extracting) audio peaks for a video src.
 * Returns null until decoding starts; `silent` marks a track with no drawable
 * audio.
 */
export function useVideoWaveform(src: string | null): VideoWaveform | null {
  const subscribe = React.useCallback(
    (listener: () => void) => (src ? subscribeTo(src, listener) : () => {}),
    [src]
  )
  const getSnapshot = React.useCallback(
    () => (src ? (entries.get(src) ?? null) : null),
    [src]
  )
  const waveform = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null
  )

  React.useEffect(() => {
    if (!src || started.has(src) || entries.get(src)?.done) return
    started.add(src)
    void extractWaveform(src)
  }, [src])

  return waveform
}
