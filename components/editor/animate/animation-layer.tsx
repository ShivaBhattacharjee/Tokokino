"use client"

/**
 * On-canvas animation playback (placeholder).
 *
 * The per-clip motion feature isn't built yet — clips are currently just
 * timeline UI — so this intentionally drives nothing and the screenshots always
 * render at rest. Adding a clip or pressing play must NOT transform or hide the
 * canvas.
 *
 * When the animation feature lands, the composed transform for the current
 * playhead will be written here as CSS vars on the canvas node
 * (`[data-canvas-id]`); the main screenshot and slot wrappers already read
 * `--anim-transform` / `--anim-opacity` / `--anim-filter`.
 */
export function AnimationLayer() {
  return null
}
