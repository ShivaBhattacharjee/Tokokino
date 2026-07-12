import type { AnimationClip } from "./state-types"

export const MIN_CLIP_MS = 200
export const GHOST_SLOT_MS = 1000
export const PX_PER_SECOND = 80
export const MIN_PX_PER_SECOND = 24
export const MAX_PX_PER_SECOND = 400
export const MIN_DURATION_MS = 1000
export const MAX_DURATION_MS = 60 * 60 * 1000
export const DEFAULT_TIMELINE_MS = 60000
export const TIMELINE_HEADROOM_MS = 15000
export const RULER_TRAILING_PX = 64
export const MIN_HANDLE_TRAILING_PX = 96

export type TimelineSegment = {
  startMs: number
  durationMs: number
}

export function timelineEndFor(
  durationMs: number,
  lastClipEnd: number
): number {
  const needed = Math.max(
    DEFAULT_TIMELINE_MS,
    durationMs + TIMELINE_HEADROOM_MS,
    lastClipEnd + TIMELINE_HEADROOM_MS
  )
  return Math.min(MAX_DURATION_MS, needed)
}

export function formatTime(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const cs = Math.floor((total % 1000) / 10)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(m)}:${pad(s)}.${pad(cs)}`
}

export function formatShort(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(m)}:${pad(s)}`
}

export function computeTicks(
  rulerEndMs: number,
  pxPerSecond: number
): number[] {
  const step =
    [1, 2, 5, 10, 15, 30, 60].find((s) => s * pxPerSecond >= 48) ?? 60
  const count = Math.floor(rulerEndMs / 1000 / step)
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

function overlaps(
  start: number,
  dur: number,
  clips: readonly TimelineSegment[]
): boolean {
  return clips.some(
    (c) => start < c.startMs + c.durationMs && start + dur > c.startMs
  )
}

export function findGhostSlot(
  cursorMs: number,
  clips: readonly AnimationClip[],
  durationMs: number,
  slotMs = GHOST_SLOT_MS
): number | null {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  let gapStart = 0
  let gapEnd = durationMs
  let prevEnd = 0
  let inGap = true
  for (const c of sorted) {
    if (cursorMs < c.startMs) {
      gapStart = prevEnd
      gapEnd = c.startMs
      break
    }
    if (cursorMs <= c.startMs + c.durationMs) {
      inGap = false
      break
    }
    prevEnd = Math.max(prevEnd, c.startMs + c.durationMs)
    gapStart = prevEnd
    gapEnd = durationMs
  }
  if (!inGap || gapEnd - gapStart < slotMs) return null
  return Math.max(gapStart, Math.min(gapEnd - slotMs, cursorMs - slotMs / 2))
}

export function resolveDropStart(
  dropped: number,
  dur: number,
  others: readonly TimelineSegment[],
  durationMs: number,
  originalStart: number
): number {
  const maxStart = durationMs - dur
  const fits = (s: number) =>
    s >= 0 && s <= maxStart && !overlaps(s, dur, others)
  if (fits(dropped)) return dropped
  const candidates = [originalStart, 0, maxStart]
  for (const o of others) {
    candidates.push(o.startMs + o.durationMs, o.startMs - dur)
  }
  return (
    candidates
      .filter(fits)
      .sort((a, b) => Math.abs(a - dropped) - Math.abs(b - dropped))[0] ??
    originalStart
  )
}

export function resolveRippleDrop(
  dropped: number,
  durationMs: number,
  others: readonly TimelineSegment[],
  maxDurationMs: number
) {
  const desired = Math.max(0, dropped)
  const prevEnd = others
    .filter((clip) => clip.startMs < desired)
    .reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0)
  const startMs = Math.min(
    Math.max(desired, prevEnd),
    Math.max(0, maxDurationMs - durationMs)
  )
  const nextStart = others
    .filter((clip) => clip.startMs >= desired)
    .reduce((min, clip) => Math.min(min, clip.startMs), Infinity)
  return {
    startMs,
    shiftAfterMs: desired,
    shiftMs: Number.isFinite(nextStart)
      ? Math.max(0, startMs + durationMs - nextStart)
      : 0,
  }
}
