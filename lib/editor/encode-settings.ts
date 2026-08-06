/**
 * Key frame interval (seconds) for every canvas → video encode: animation
 * export, styled-video export, and the GIF transcode.
 *
 * Mediabunny defaults to 2s, which is fine for playback but makes the output
 * miserable to scrub — a `<video>` can only land on a key frame while the user
 * drags, so a 2s GOP means the canvas holds the same frame across a two-second
 * stretch of timeline. Tokokino exports get re-imported into Tokokino, so the
 * shorter interval buys back scrub accuracy at the cost of some file size.
 */
export const ENCODE_KEY_FRAME_INTERVAL_SEC = 0.5
