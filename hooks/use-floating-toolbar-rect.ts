"use client"

import * as React from "react"

type Options = {
  elRef: React.RefObject<HTMLElement | null>
  isSelected: boolean
  bulkCanvasDragging: boolean
  /** Event kind string to match against the hide-floating-toolbar event */
  kind: string
  /**
   * Element id to match. Pass null to respond to any event of this kind
   * (used for the main screenshot which has no per-element id).
   */
  elementId: string | null
  /** Also track shouldAnimatePositionMove (used by text + asset elements) */
  trackPositionAnimate?: boolean
  /** Called on every ResizeObserver / scroll / resize tick with the element */
  onResize?: (el: HTMLElement) => void
}

type Result = {
  toolbarRect: DOMRect | null
  hideFloatingToolbar: boolean
  shouldAnimatePositionMove: boolean
  /** Call this inside a per-component position-deps effect to re-measure after movement */
  measureRect: () => void
  setToolbarRect: React.Dispatch<React.SetStateAction<DOMRect | null>>
}

/**
 * Shared logic for floating toolbars that are portalled to document.body and
 * need to track the bounding rect of a canvas element.
 *
 * Handles:
 *  1. ResizeObserver + scroll/resize listeners → keeps toolbarRect current
 *     CSS position transitions then re-measures at the settled position via rAF
 *  2. shouldAnimatePositionMove flag (opt-in) for CSS transition coordination
 */
export function useFloatingToolbarRect({
  elRef,
  isSelected,
  bulkCanvasDragging,
  kind,
  elementId,
  trackPositionAnimate = false,
  onResize,
}: Options): Result {
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)
  const [hideFloatingToolbar, setHideFloatingToolbar] = React.useState(false)
  const [shouldAnimatePositionMove, setShouldAnimatePositionMove] =
    React.useState(false)

  const onResizeRef = React.useRef(onResize)
  onResizeRef.current = onResize

  // 1. Listen for the hide event emitted when position changes via the toolbar picker
  React.useEffect(() => {
    const onHide = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          kind?: string
          id?: string
          durationMs?: number
        }>
      ).detail
      if (detail?.kind !== kind) return
      if (elementId !== null && detail.id !== elementId) return
      setHideFloatingToolbar(true)
      const durationMs = detail.durationMs ?? 320
      if (trackPositionAnimate) {
        setShouldAnimatePositionMove(true)
        window.setTimeout(() => setShouldAnimatePositionMove(false), durationMs)
      }
      window.setTimeout(() => setHideFloatingToolbar(false), durationMs)
    }
    window.addEventListener(
      "noctivy:hide-floating-toolbar",
      onHide
    )
    return () =>
      window.removeEventListener(
        "noctivy:hide-floating-toolbar",
        onHide
      )
  }, [elementId, kind, trackPositionAnimate])

  // 2. ResizeObserver + scroll / resize: keep rect in sync while selected
  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected || !elRef.current) {
      setToolbarRect(null)
      return
    }
    const el = elRef.current
    const update = () => {
      setToolbarRect(el.getBoundingClientRect())
      onResizeRef.current?.(el)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  // elRef is a stable ref object — its identity doesn't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCanvasDragging, isSelected])

  // 3. rAF after hide→show flip: re-measure at the settled (post-transition) position
  React.useEffect(() => {
    if (
      bulkCanvasDragging ||
      !isSelected ||
      hideFloatingToolbar ||
      !elRef.current
    )
      return
    const rafId = window.requestAnimationFrame(() => {
      if (!elRef.current) return
      setToolbarRect(elRef.current.getBoundingClientRect())
    })
    return () => window.cancelAnimationFrame(rafId)
  // elementId as a dep so this re-fires whenever "which element is selected" changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCanvasDragging, hideFloatingToolbar, isSelected, elementId])

  const measureRect = React.useCallback(() => {
    if (!elRef.current) return
    setToolbarRect(elRef.current.getBoundingClientRect())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    toolbarRect,
    hideFloatingToolbar,
    shouldAnimatePositionMove,
    measureRect,
    setToolbarRect,
  }
}
