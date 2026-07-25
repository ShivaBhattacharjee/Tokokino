/**
 * The AV1 fallback's two lazily fetched assets, reachable without pulling in
 * the decoder itself (which drags mediabunny along with it).
 *
 * Both are deliberately kept out of the normal export chunk — they are only
 * fetched when native AV1 decoding fails on WebKit — which also means neither
 * appears in the performance timeline or the /app markup that offline capture
 * reads. `lib/offline/offline-shell.ts` uses this module to pull them in
 * explicitly, so an offline editor can still export AV1 video.
 */

export const dav1dWasmUrl = new URL(
  "./dav1d-wasm/decoder.wasm",
  import.meta.url
).toString()

/** Fetches the decoder chunk into the browser cache without instantiating it. */
export async function preloadDav1dChunk() {
  await import("./dav1d-wasm/decoder.mjs")
}
