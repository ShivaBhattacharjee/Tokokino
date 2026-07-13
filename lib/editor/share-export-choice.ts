/**
 * Animate mode can be open for video trimming even when the canvas has no
 * visual keyframes. In that case the keyframe exporter has nothing to render;
 * the styled video compositor is the correct share/export path.
 */
export function shouldUseVideoMediaShareExport({
  isVideoCanvas,
  isAnimateMode,
  keyframeCount,
}: {
  isVideoCanvas: boolean
  isAnimateMode: boolean
  keyframeCount: number
}) {
  return isVideoCanvas && (!isAnimateMode || keyframeCount === 0)
}
