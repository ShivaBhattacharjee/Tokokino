/**
 * Message shapes exchanged with the video mux worker. Kept separate from both
 * ends so neither pulls in the other's runtime.
 */

import type { VideoSegment } from "../video-layer"

export type VideoMuxerAudioConfig = {
  /** The source clip's bytes; the worker reads its audio track out of these. */
  blob: Blob
  /** Export window in seconds — audio at or past this is dropped. */
  durationSec: number
  /**
   * Timeline segments to re-time the audio onto (Animate mode), or null for the
   * video-media export, which plays the clip straight through.
   */
  segments: VideoSegment[] | null
}

export type VideoMuxerConfig = {
  format: "mp4" | "webm"
  width: number
  height: number
  fps: number
  keyFrameIntervalSec: number
  audio: VideoMuxerAudioConfig | null
}

export type VideoMuxerRequest =
  | { id: number; type: "init"; config: VideoMuxerConfig }
  | {
      id: number
      type: "frame"
      frame: VideoFrame
      timestampSec: number
      durationSec: number
    }
  | { id: number; type: "finalize" }
  | { id: number; type: "cancel" }

export type VideoMuxerResponse =
  | { id: number; ok: true; type: "init"; supported: boolean }
  | { id: number; ok: true; type: "frame" }
  | { id: number; ok: true; type: "finalize"; buffer: ArrayBuffer }
  | { id: number; ok: true; type: "cancel" }
  | { id: number; ok: false; error: string; aborted?: boolean }
