import posthog from "posthog-js"

import type { CanvasState } from "@/lib/editor/state-types"

/**
 * Every event the client sends, in one place.
 *
 * The union is the point: a typo in a `capture()` string does not fail, it
 * quietly creates a second event that splits a funnel in half and is only
 * noticed weeks later in the PostHog UI.
 */
export type AnalyticsEvent =
  // Activation — the denominator for everything else.
  | "screenshot_added"
  | "screenshot_added_failed"
  // Auth funnel.
  | "sign_in_initiated"
  | "sign_in_completed"
  | "signed_out"
  | "auth_gate_shown"
  // Export.
  | "screenshot_exported"
  | "animation_exported"
  | "export_failed"
  // Share.
  | "share_started"
  | "share_failed"
  | "share_link_copied"
  | "canvas_copied_to_clipboard"
  // Share view page (the public/viral surface).
  | "share_viewed"
  | "share_image_copied"
  | "share_downloaded"
  // Drafts.
  | "draft_saved"
  | "draft_save_failed"
  | "draft_opened"
  | "draft_open_failed"
  // Presets and templates.
  | "preset_saved"
  | "preset_updated"
  | "template_applied"
  // Feature adoption.
  | "feedback_submitted"
  | "offline_install_toggled"
  | "bulk_edit_entered"
  | "animate_mode_entered"
  | "unsplash_searched"
  // Snapshot of what the user actually built, sent at export/share time.
  | "design_composition"

/**
 * Capture never throws into product code. An ad blocker, a missing token, or a
 * PostHog outage must not be able to break an export.
 */
export function capture(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): void {
  try {
    posthog.capture(event, properties)
  } catch (error) {
    console.warn("[analytics] capture failed", error)
  }
}

export function identifyUser(user: {
  id: string
  email?: string | null
  name?: string | null
  createdAt?: string | Date | null
}): void {
  try {
    const createdAt =
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : (user.createdAt ?? undefined)
    posthog.identify(
      user.id,
      { email: user.email ?? undefined, name: user.name ?? undefined },
      // Set-once, so the signup date survives every later login rewriting it.
      createdAt ? { initial_signup_at: createdAt } : undefined
    )
  } catch (error) {
    console.warn("[analytics] identify failed", error)
  }
}

/**
 * Must run on every sign-out. Without it the distinct_id survives into the next
 * session, so a second user on a shared device is merged into the first user's
 * person profile — which also rewrites history, not just future events.
 */
export function resetAnalytics(): void {
  try {
    posthog.reset()
  } catch (error) {
    console.warn("[analytics] reset failed", error)
  }
}

/**
 * A single snapshot of the composition, sent when the user exports or shares.
 *
 * Deliberately not per-control: instrumenting each slider would emit thousands
 * of events per session and still not answer "which features does a finished
 * design actually use", which is the question that decides what to keep
 * building. One event at the moment of intent answers it directly.
 */
export function compositionProperties(
  canvas: CanvasState | undefined
): Record<string, unknown> {
  if (!canvas) return {}
  return {
    background_type: canvas.background.type,
    shadow_type: canvas.shadow.type,
    frame_id: canvas.frame.id || null,
    frame_orientation: canvas.frame.orientation,
    portrait_mode: canvas.portrait.mode,
    enhance_preset: canvas.enhance,
    overlay_id: canvas.overlay.id,
    has_border: canvas.border.width > 0,
    padding: canvas.padding,
    text_count: canvas.texts.length,
    asset_count: canvas.assets.length,
    annotation_count:
      canvas.annotations.length + canvas.annotationShapes.length,
    slot_count: canvas.screenshotSlots.filter((slot) => slot.src).length,
    has_tweet: canvas.tweet !== null,
    is_cropped: canvas.lastCropRegion !== null,
    object_fit: canvas.objectFit ?? "contain",
  }
}
