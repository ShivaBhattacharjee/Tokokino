# Resumable Video Canvas Sharing Design

## Goal

Let a canvas whose primary media is a video create a public MP4, WebM, or GIF
share link using the same chooser and progress surface as Animate mode. Uploads
must survive connection failures, reloads, and later browser restarts without
re-uploading confirmed video bytes.

## Scope

- Video canvases open the existing animation-share chooser from Share, with
  format and resolution choices, quota status, progress, retry, and a
  video-specific title.
- The existing styled-video compositor supplies the share media, preserving the
  canvas styling, video trim, and audio where the selected format supports it.
- Animate shares use the same durable upload path once it is available.
- Still-image sharing remains on its existing single-request path.

## Client architecture

After the compositor has produced the final media Blob, the client writes the
Blob, poster Blob, upload session id, source signature, and selected settings to
an IndexedDB share-upload store. The browser creates a server upload session,
then sends 8 MiB media parts sequentially. A confirmed part is never sent again.

The client retries transient failures with bounded exponential backoff. It pauses
while offline and resumes on the `online` event. Opening the editor later reads
pending IndexedDB records and asks the server for the authoritative confirmed
part list before continuing. A Retry action always resumes the durable session.

An encoding process cannot be continued after a tab is closed because browser
media encoders do not provide a checkpointable encoding state. Once encoding has
completed, however, its persisted Blob allows upload recovery without encoding
again.

## Server architecture

A D1 `share_uploads` table represents an upload session with a stable share id,
the owning user, media metadata, a reservation for its byte size, R2 multipart
upload id, status, expiry time, and the confirmed part numbers/ETags. The API
creates a multipart upload in R2 before returning the session to the client.

Each part endpoint authenticates the session owner, validates the exact byte
range and part size, writes the part to R2, and records the returned ETag. If a
request is interrupted after R2 accepts the part but before D1 is updated, the
resume-status endpoint reconciles that part with R2's multipart part list.

The finish endpoint is idempotent. It completes R2 multipart upload, writes the
single public `shares` record, and returns the stable public URL. If a response
is lost after completion, another finish call returns the already-created share;
it cannot publish a duplicate. A poster is best-effort and never blocks media
publication.

## Integrity, consistency, and cleanup

- A session reserves its proposed byte size before upload. Active reservations
  count toward the 1 GB quota, preventing concurrent uploads from overspending
  storage.
- The server accepts parts only for the session's content type, total size, and
  expected range. R2 ETags and the persisted part manifest identify completed
  bytes.
- Media remains private and unreferenced until multipart completion and share
  record creation. Public reads require the share record, so unfinished uploads
  cannot leak.
- A terminal session is immutable. Completion and cancellation are idempotent.
- Expired sessions are aborted in R2 and removed from D1, releasing their quota
  reservation. Orphan cleanup also handles server failures between R2 and D1.

## UI and recovery behavior

For a video canvas, Share opens the same configuration UI currently used for
Animate mode: MP4, WebM, and GIF options; HD, Full HD, and 4K resolution
choices; storage information; phase-aware progress; and retry. The title and
copy identify it as a video share. The progress UI reports encoding separately
from resumable upload progress and includes completed bytes/parts while
uploading.

When a pending upload is recovered after reopening the app, the UI shows its
saved format and resolution and can continue from the first missing part. An
unrecoverable local Blob loss explains that the user must create the share again;
the server session is cancelled so its quota reservation is released.

## Verification

Do not run automated tests or browser checks without the user's permission.
Use `pnpm typecheck` as the only code verification command once implementation
is complete.
