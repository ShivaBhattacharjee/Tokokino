"use client"

import { create } from "zustand"

// Bridges the <video> element (rendered deep inside the canvas) to the docked
// video control bar (rendered up by the floating toolbar). Keyed by canvas id
// so the bar always drives the active canvas's video.
type VideoRegistryState = {
  videos: Record<string, HTMLVideoElement>
  registerVideo: (canvasId: string, el: HTMLVideoElement | null) => void
}

export const useVideoRegistry = create<VideoRegistryState>((set) => ({
  videos: {},
  registerVideo: (canvasId, el) =>
    set((state) => {
      const current = state.videos[canvasId] ?? null
      if (current === el) return state
      const videos = { ...state.videos }
      if (el) videos[canvasId] = el
      else delete videos[canvasId]
      return { videos }
    }),
}))
