// Pure geometry + formatting helpers for the Animate-mode timeline. Kept free
// of React so the interaction component stays lean and these stay testable.

import type { AnimationClip } from "./state-types"

export const MIN_CLIP_MS = 200
// The hover-to-add affordance previews a fixed one-second slot.
export const GHOST_SLOT_MS = 1000
// Default timeline scale in pixels per second. Trackpad pinch / ctrl+wheel
// scales this between the bounds below; the track scrolls horizontally.
export const PX_PER_SECOND = 80
export const MIN_PX_PER_SECOND = 24
export const MAX_PX_PER_SECOND = 400
// Duration bounds for the drag-to-resize end handle. MAX_DURATION_MS is now just
// a generous hard ceiling (not a 1-minute cap) — the visible timeline length is
// dynamic (see timelineEndFor) and grows with the content, so short animations
// keep a short track while long ones can extend up to this ceiling.
export const MIN_DURATION_MS = 1000
export const MAX_DURATION_MS = 60 * 60 * 1000 // 60 min hard ceiling
// The track never renders shorter than this, so a fresh timeline still reads as
// a real editor rather than a sliver.
export const DEFAULT_TIMELINE_MS = 60000
// Slack kept past the content end so the duration handle always has room to be
// dragged further in one motion (the track grows as you approach it).
export const TIMELINE_HEADROOM_MS = 15000
// Room kept past the end handle so its label isn't clipped at the edge.
export const RULER_TRAILING_PX = 64
// Minimum pixel gap kept to the RIGHT of the duration handle, regardless of zoom.
// The time-based headroom (TIMELINE_HEADROOM_MS) collapses to a few pixels when
// zoomed out, which would jam the handle against the scroll/panel edge — this
// floor keeps it comfortably grabbable at any zoom.
export const MIN_HANDLE_TRAILING_PX = 96

/**
 * Visible/interactive length of the timeline. Grows with the content — the set
 * duration and the furthest clip — plus headroom to keep extending, and never
 * shorter than DEFAULT_TIMELINE_MS or longer than the MAX_DURATION_MS ceiling.
 * This is what removes the old fixed 1-minute cap without rendering a giant
 * mostly-empty track for short animations.
 */
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

/** Second-marked ruler ticks; the interval widens as you zoom out. */
export function computeTicks(
  rulerEndMs: number,
  pxPerSecond: number
): number[] {
  const step =
    [1, 2, 5, 10, 15, 30, 60].find((s) => s * pxPerSecond >= 48) ?? 60
  const count = Math.floor(rulerEndMs / 1000 / step)
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

/** True when a [start, start+dur) slot overlaps any of the given clips. */
function overlaps(
  start: number,
  dur: number,
  clips: readonly AnimationClip[]
): boolean {
  return clips.some(
    (c) => start < c.startMs + c.durationMs && start + dur > c.startMs
  )
}

/**
 * Free one-second slot for the add affordance, centered on `cursorMs` and
 * clamped into the gap the cursor sits in. Returns null when the cursor is over
 * a clip or the gap is too small to hold a slot.
 */
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

/**
 * Resolve where a moved clip should land after being dropped at `dropped`. If
 * that spot is free it stays; otherwise it snaps to the nearest free position
 * (flush against a neighbour or a timeline edge), falling back to `originalStart`.
 */
export function resolveDropStart(
  dropped: number,
  dur: number,
  others: readonly AnimationClip[],
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
