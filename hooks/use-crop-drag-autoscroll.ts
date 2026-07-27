import * as React from "react"

/** How close to an edge (px) the pointer gets before the view follows it. */
const EDGE_ZONE = 56
/** Fastest auto-scroll, px per frame, reached once the pointer is at the edge. */
const MAX_SPEED = 20
const MIN_SPEED = 2

type DragState = {
  pointerId: number
  target: EventTarget
  clientX: number
  clientY: number
  /** How far the view has scrolled under the pointer during this drag. */
  offsetX: number
  offsetY: number
  frame: number | null
  /** True while we re-dispatch, so the capture listener ignores its own event. */
  redispatching: boolean
}

function axisSpeed(position: number, min: number, max: number) {
  const speed = (depth: number) =>
    Math.min(MAX_SPEED, Math.max(MIN_SPEED, (depth / EDGE_ZONE) * MAX_SPEED))
  if (position < min + EDGE_ZONE) return -speed(min + EDGE_ZONE - position)
  if (position > max - EDGE_ZONE) return speed(position - (max - EDGE_ZONE))
  return 0
}

/**
 * Scrolls the crop viewport when a drag reaches its edges. Without it a crop
 * can never be dragged past one screenful of a zoomed-in screenshot — the
 * pointer just stops at the edge.
 *
 * The compensation is the fiddly part: react-image-crop places the crop from
 * the pointer's TOTAL delta since pointerdown, so scrolling the image under a
 * stationary pointer would leave the crop behind. Every pointermove is
 * intercepted on `window` in the capture phase — ahead of the library's own
 * document capture listener — and re-dispatched with the scrolled distance
 * added, which keeps the crop edge glued to the cursor.
 */
export function useCropDragAutoScroll(
  viewportRef: React.RefObject<HTMLDivElement | null>
) {
  const drag = React.useRef<DragState | null>(null)

  return React.useMemo(() => {
    const redispatch = (
      state: DragState,
      type: "pointermove" | "pointerup"
    ) => {
      state.redispatching = true
      state.target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: state.clientX + state.offsetX,
          clientY: state.clientY + state.offsetY,
          pointerId: state.pointerId,
          buttons: type === "pointerup" ? 0 : 1,
        })
      )
      state.redispatching = false
    }

    const dispatchMove = (state: DragState) => redispatch(state, "pointermove")

    const step = () => {
      const state = drag.current
      const node = viewportRef.current
      if (!state || !node) return
      const rect = node.getBoundingClientRect()
      const dx = axisSpeed(state.clientX, rect.left, rect.right)
      const dy = axisSpeed(state.clientY, rect.top, rect.bottom)
      if (dx || dy) {
        const fromX = node.scrollLeft
        const fromY = node.scrollTop
        node.scrollLeft = fromX + dx
        node.scrollTop = fromY + dy
        // Only what the element actually scrolled counts — at either end of the
        // range it clamps, and over-counting would drag the crop off-cursor.
        const movedX = node.scrollLeft - fromX
        const movedY = node.scrollTop - fromY
        if (movedX || movedY) {
          state.offsetX += movedX
          state.offsetY += movedY
          dispatchMove(state)
        }
      }
      state.frame = requestAnimationFrame(step)
    }

    const onMove = (event: PointerEvent) => {
      const state = drag.current
      if (!state || state.redispatching) return
      if (event.pointerId !== state.pointerId) return
      state.clientX = event.clientX
      state.clientY = event.clientY
      if (state.offsetX || state.offsetY) {
        // The cropper must never see the raw coordinates once the view has
        // moved: they would snap the crop back by the scrolled distance.
        event.stopImmediatePropagation()
        event.preventDefault()
        dispatchMove(state)
      }
      // Started on the first move, not on pointerdown, so merely holding the
      // button near an edge doesn't scroll.
      state.frame ??= requestAnimationFrame(step)
    }

    const stop = () => {
      const state = drag.current
      if (!state) return
      if (state.frame !== null) cancelAnimationFrame(state.frame)
      drag.current = null
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("pointerup", onUp, true)
      window.removeEventListener("pointercancel", stop, true)
    }

    /**
     * The edge-resize bars settle the crop from the pointerup coordinates, so
     * that event needs the same compensation the moves got — otherwise the crop
     * snaps back by the scrolled distance the moment the drag ends.
     */
    function onUp(event: PointerEvent) {
      const state = drag.current
      if (!state || state.redispatching) return
      if (event.pointerId !== state.pointerId) return
      if (state.offsetX || state.offsetY) {
        state.clientX = event.clientX
        state.clientY = event.clientY
        event.stopImmediatePropagation()
        redispatch(state, "pointerup")
      }
      stop()
    }

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      stop()
      drag.current = {
        pointerId: event.pointerId,
        target: event.target,
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: 0,
        offsetY: 0,
        frame: null,
        redispatching: false,
      }
      window.addEventListener("pointermove", onMove, true)
      window.addEventListener("pointerup", onUp, true)
      window.addEventListener("pointercancel", stop, true)
    }

    return { onPointerDown, stop }
  }, [viewportRef])
}
