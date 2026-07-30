"use client"

import * as React from "react"

/**
 * Content-box size of the padded stage, tracked with a ResizeObserver.
 *
 * Padding is previewed through `--editor-padding-preview` (slider drags,
 * animation playback) without ever reaching the store, so anything that derives
 * geometry from the committed `padding` describes a stage the browser is not
 * currently laying out. Measuring gives the empty-state placeholder the same
 * source of truth `usePlacementMeasurement` already gives a real screenshot.
 */
export function useBareStageSize(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null)

  React.useLayoutEffect(() => {
    const el = enabled ? ref.current : null
    if (!el) {
      setSize(null)
      return
    }

    // contentRect is the content box regardless of box-sizing, and unlike
    // getBoundingClientRect it ignores the canvas' zoom transform.
    const apply = (w: number, h: number) => {
      if (!(w > 0) || !(h > 0)) return
      setSize((prev) =>
        prev && prev.w === w && prev.h === h ? prev : { w, h }
      )
    }
    const measure = () => {
      const style = getComputedStyle(el)
      apply(
        el.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
        el.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom)
      )
    }

    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) apply(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, ref])

  return size
}
