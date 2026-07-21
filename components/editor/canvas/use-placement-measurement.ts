"use client"

import * as React from "react"

export type PlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

const sameDims = (a: PlacementDims, b: PlacementDims) =>
  a.stageW === b.stageW &&
  a.stageH === b.stageH &&
  a.imgW === b.imgW &&
  a.imgH === b.imgH

export function usePlacementMeasurement({
  enabled,
  stageRef,
  imageRef,
  layoutKey,
}: {
  enabled: boolean
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  layoutKey?: string | number
}) {
  const [measured, setMeasured] = React.useState<{
    key: string | number | undefined
    dims: PlacementDims | null
  }>({ key: layoutKey, dims: null })

  /**
   * Contain shells are sized FROM these dims, so a measurement outlives the
   * layout it described: the shell stays pinned to the old box, the
   * ResizeObserver never sees a change, and nothing ever re-measures. Swapping
   * media (e.g. a cropped image → a video) left the new media rendering inside
   * the previous one's box until a reload.
   *
   * Dropping the measurement in the same render the key changes breaks that
   * loop — the shell falls back to its aspect-driven size, and the layout effect
   * below measures the real new box.
   */
  const placementDims = measured.key === layoutKey ? measured.dims : null

  const measurePlacement = React.useCallback(() => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    const next = {
      stageW: parseFloat(getComputedStyle(stage).width) || stage.clientWidth,
      stageH: parseFloat(getComputedStyle(stage).height) || stage.clientHeight,
      imgW: image.offsetWidth,
      imgH: image.offsetHeight,
    }

    if (!next.stageW || !next.stageH || !next.imgW || !next.imgH) return

    setMeasured((prev) => {
      if (prev.key === layoutKey && prev.dims && sameDims(prev.dims, next)) {
        return prev
      }
      return { key: layoutKey, dims: next }
    })
  }, [imageRef, layoutKey, stageRef])

  React.useLayoutEffect(() => {
    if (!enabled) return

    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    measurePlacement()
    const raf = window.requestAnimationFrame(measurePlacement)

    const observer = new ResizeObserver(measurePlacement)
    observer.observe(stage)
    observer.observe(image)
    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [enabled, imageRef, layoutKey, measurePlacement, stageRef])

  return { placementDims, measurePlacement }
}
