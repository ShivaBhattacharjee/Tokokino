# Video Timeline Clip Interactions Design

## Goal

Make video timeline clips behave like animation clips when selected and moved.

## Interaction

- A pointer release on an already selected video clip, without moving beyond the existing drag threshold, clears the video clip selection.
- Moving a video clip marks its drag as active once the pointer passes the existing four-pixel threshold.
- During an active move drag, every selected video clip lifts three pixels and renders at reduced opacity. Trim drags retain their current appearance.
- Releasing a moved clip preserves the existing ripple-drop calculation and selection.

## Implementation

`use-animate-timeline.ts` will retain the video clip's initial selection and pointer position in the video drag state, derive the active moving clip IDs, and clear the selection only for a stationary click on a previously selected clip. `animate-bar.tsx` will pass each clip's drag state into `TimelineVideoClip`. `timeline-video-clip.tsx` will use that state to animate the same lift and translucency used by animation clips.

## Validation

Run `pnpm typecheck` only. No automated tests or browser checks, per project instructions.
