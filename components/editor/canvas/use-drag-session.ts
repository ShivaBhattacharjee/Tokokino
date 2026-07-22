"use client"

import * as React from "react"

/**
 * A monotonic token for a single pointer interaction (drag / preview gesture).
 *
 * Drag handlers commit their value on pointer-up but defer clearing the
 * live-preview CSS vars by a frame (so the committed value paints before the var
 * is removed, avoiding a one-frame jump). If the user re-grabs the same element
 * before that frame runs, the *old* interaction's deferred cleanup must not wipe
 * the *new* one's vars or reset its dragging flag.
 *
 * Call {@link DragSession.begin} when a gesture starts, snapshot
 * {@link DragSession.current} when scheduling deferred work, and gate that work
 * on {@link DragSession.isCurrent}. This replaces the ad-hoc `if (dragRef.current)
 * return` guards, which only caught an *in-progress* newer drag — not a newer one
 * that had already begun and ended.
 */
export type DragSession = {
  /** Start a new interaction, invalidating any pending deferred cleanup. */
  begin: () => void
  /** The current interaction's token, to capture when scheduling deferred work. */
  current: () => number
  /** True only while `token` is still the latest interaction. */
  isCurrent: (token: number) => boolean
}

export function useDragSession(): DragSession {
  const tokenRef = React.useRef(0)
  return React.useMemo(
    () => ({
      begin: () => {
        tokenRef.current += 1
      },
      current: () => tokenRef.current,
      isCurrent: (token: number) => tokenRef.current === token,
    }),
    []
  )
}
