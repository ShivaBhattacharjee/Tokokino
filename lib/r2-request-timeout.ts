/**
 * Draft uploads stream from the browser through the API to R2. They must not
 * be cancelled merely because that continuous stream lasts longer than a fixed
 * request window; client disconnects still abort the underlying request.
 */
export const R2_STREAM_REQUEST_TIMEOUT_MS = 0
