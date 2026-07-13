/** Converts internal animation-export failures into useful user-facing copy. */
export function animationExportErrorMessage(
  error: unknown,
  fallback = "Animation export failed. Please try again."
) {
  const message = error instanceof Error ? error.message.trim() : ""
  if (message === "Add at least one keyframe before sharing") {
    return "Add a keyframe before exporting this animation."
  }
  if (message === "Nothing to export") {
    return "Nothing to export — add a keyframe first."
  }
  return message || fallback
}
