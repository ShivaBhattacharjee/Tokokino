import { isDraftStateLike, unwrapDraftState } from "@/lib/schemas/draft"

import { liveClipCount, payloadClipCount } from "../animation-presence"
import { useEditorStore } from "../store"
import type { Template } from "./types"

/** An apply that failed in a way worth showing the user verbatim. */
export class TemplateApplyError extends Error {
  /** Whether the editor state was already replaced when this was thrown. */
  readonly stateReplaced: boolean

  constructor(message: string, stateReplaced: boolean) {
    super(message)
    this.name = "TemplateApplyError"
    this.stateReplaced = stateReplaced
  }
}

/** True when the failed apply left the template's state in the editor. */
export function templateApplyReplacedState(error: unknown) {
  return error instanceof TemplateApplyError && error.stateReplaced
}

/**
 * Apply a template as a fresh unsaved project.
 *
 * Loading is lossy by design (see `animation-presence`): a template whose
 * animation no longer matches the shape the store expects loads as a still
 * composition — canvas styled, clips gone, and nothing to distinguish it from a
 * template that never had an animation. Check the clips both before and after
 * the load and throw, so the caller reports a failure instead of a success
 * toast over a silently dead timeline.
 */
export function applyTemplate(template: Template) {
  if (!isDraftStateLike(template.state)) {
    throw new TemplateApplyError(
      `"${template.name}" is missing its canvas.`,
      false
    )
  }
  const { present, ui } = unwrapDraftState(template.state)
  const isAnimation = template.category === "animation"
  // Caught before the load so a template that never had a usable animation
  // leaves the user's current project alone.
  if (
    isAnimation &&
    !(ui.isAnimateMode && payloadClipCount(present.canvases))
  ) {
    throw new TemplateApplyError(
      `"${template.name}" is missing its animation and can't be applied.`,
      false
    )
  }

  useEditorStore.getState().loadTemplateState(present, ui)

  if (isAnimation && !liveClipCount(useEditorStore.getState().present)) {
    throw new TemplateApplyError(
      `Applied "${template.name}", but its animation could not be loaded.`,
      true
    )
  }
}

export function templateApplyErrorMessage(error: unknown) {
  return error instanceof TemplateApplyError
    ? error.message
    : "Could not apply template"
}
