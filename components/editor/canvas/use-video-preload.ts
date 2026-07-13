import { useCanvasPreviewMode } from "@/lib/editor/store"

/**
 * Preset thumbnails can mount many copies of one source video. They should not
 * compete with the editable canvas for range requests. The visible canvas
 * only reads metadata until the user presses Play, letting the native player
 * request playback ranges as they are needed.
 */
export function useVideoPreload() {
  return useCanvasPreviewMode() ? "none" : "metadata"
}
