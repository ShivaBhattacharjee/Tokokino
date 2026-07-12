# Resumable Video Canvas Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users share a styled video canvas through the Animate-style Share UI, with durable multipart uploads that resume after reload, restart, offline interruptions, and lost completion responses.

**Architecture:** The browser renders a final MP4/WebM/GIF Blob with the existing video compositor, persists it in an IndexedDB upload queue, then sends 8 MiB parts to authenticated application endpoints. D1 stores the durable upload session and R2 multipart manifest; the server performs idempotent completion and creates the public share record only after the object is complete.

**Tech Stack:** Next.js App Router route handlers, React 19, Zustand, IndexedDB, Cloudflare D1 via Drizzle, R2 through the AWS S3 SDK, Mediabunny video compositor, TypeScript.

## Global Constraints

- Do not run automated tests, browser checks, builds, or lint commands without user permission.
- Use `pnpm typecheck` as the only code-verification command.
- Retain existing still-image sharing behavior.
- Use 8 MiB sequential parts (above R2/S3 multipart's 5 MiB non-final-part minimum).
- Persist completed export Blobs and upload metadata locally so upload recovery never re-encodes.
- Preserve project-owned uncommitted changes; do not stage or commit unrelated files.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `migrations/0010_share_uploads.sql` | Creates durable upload-session and confirmed-part tables plus expiry indexes. |
| `lib/db/schema.ts` | Defines Drizzle types and tables for sessions and parts. |
| `lib/share-upload-db.ts` | Owns session state transitions, quota reservations, part records, and expiry queries. |
| `lib/share-storage.ts` | Wraps R2 multipart create/upload/list/complete/abort/head operations. |
| `app/api/share/uploads/route.ts` | Authenticated create/list recovery endpoint. |
| `app/api/share/uploads/[id]/route.ts` | Authenticated status and cancellation endpoint. |
| `app/api/share/uploads/[id]/parts/[partNumber]/route.ts` | Validates and uploads one exact part, then records its ETag. |
| `app/api/share/uploads/[id]/complete/route.ts` | Idempotently completes media and publishes its share record. |
| `app/api/share/uploads/[id]/poster/route.ts` | Best-effort persistent poster upload for the completed share. |
| `lib/share-upload-client.ts` | IndexedDB queue and browser-side chunk/retry/resume orchestration. |
| `components/editor/top-bar/index.tsx` | Selects video-canvas share behavior, drives encode/upload/recovery, and never aborts durable uploads when the dialog closes. |
| `components/editor/top-bar/types.ts` | Adds video share state/signatures where needed. |
| `components/editor/top-bar/share-controls.tsx` | Reuses Animate options for video shares and renders byte-based resumable progress. |

### Task 1: Add Durable Upload Persistence

**Files:**
- Create: `migrations/0010_share_uploads.sql`
- Modify: `lib/db/schema.ts`
- Create: `lib/share-upload-db.ts`

**Interfaces:**
- Produces `ShareUploadSession`, `ShareUploadPart`, `createShareUploadSession`, `recordShareUploadPart`, `getShareUploadForUser`, `getShareUploadParts`, `markShareUploadFinalizing`, `markShareUploadComplete`, `cancelExpiredShareUploads`.
- Consumes `MAX_USER_SHARE_STORAGE_BYTES` and the existing `shares` table.

- [ ] **Step 1: Add the migration and schema types**

Create a `share_uploads` row with `id`, `share_id`, `user_id`, `object_key`, `r2_upload_id`, `content_type`, `size_bytes`, `status` (`active`, `finalizing`, `complete`, `cancelled`), `poster_key`, timestamps, and `expires_at`. Create `share_upload_parts` with a `(upload_id, part_number)` primary key, `etag`, `size_bytes`, and timestamp. Index active sessions by `(user_id, expires_at)` and expiry by `expires_at`.

- [ ] **Step 2: Implement quota-safe session and part storage**

In `lib/share-upload-db.ts`, calculate active, unexpired reservations alongside completed `shares.sizeBytes` before creating a session. Reject a request whose reservation would exceed the 1 GB quota. Store a part with an upsert keyed by session/part number so a retry is idempotent. All lookup and state-transition functions require both upload id and user id.

- [ ] **Step 3: Implement completion and expiry transitions**

Make `markShareUploadFinalizing` conditional on an active/finalizing state, and make `markShareUploadComplete` record the stable share URL metadata. Return an existing complete session rather than creating a second share. Provide an expiry query that only returns active/finalizing sessions older than their expiry.

- [ ] **Step 4: Review the migration and database API**

Confirm the session has a stable `share_id`, the reservation includes only unexpired unfinished sessions, every part is scoped to its session, and no completed share can be counted twice toward quota.

### Task 2: Add R2 Multipart Operations and Authenticated Routes

**Files:**
- Modify: `lib/share-storage.ts`
- Create: `app/api/share/uploads/route.ts`
- Create: `app/api/share/uploads/[id]/route.ts`
- Create: `app/api/share/uploads/[id]/parts/[partNumber]/route.ts`
- Create: `app/api/share/uploads/[id]/complete/route.ts`
- Create: `app/api/share/uploads/[id]/poster/route.ts`

**Interfaces:**
- Consumes Task 1 session APIs.
- Produces `POST /api/share/uploads`, `GET|DELETE /api/share/uploads/:id`, `PUT /api/share/uploads/:id/parts/:partNumber`, `POST /api/share/uploads/:id/complete`, and `PUT /api/share/uploads/:id/poster`.

- [ ] **Step 1: Add multipart R2 storage functions**

Use `CreateMultipartUploadCommand`, `UploadPartCommand`, `ListPartsCommand`, `CompleteMultipartUploadCommand`, `AbortMultipartUploadCommand`, and `HeadObjectCommand`. Add `shareUploadId` and `userId` object metadata during creation. Return the exact R2 ETag from every uploaded part. Reject bodies larger than one part and require a non-final part to be exactly 8 MiB.

- [ ] **Step 2: Implement session creation and recovery status**

`POST /api/share/uploads` validates `contentType` against MP4/WebM/GIF, requires an integer `sizeBytes` from 1 through 1 GB, reserves quota, starts R2 multipart upload, and persists the session. `GET /api/share/uploads/:id` authenticates the owner, rejects expired sessions, lists R2 parts, reconciles them into D1, and returns confirmed part numbers plus the stable share URL when complete.

- [ ] **Step 3: Implement exact-range part uploads**

The part route validates the positive part number, `Content-Range`, declared total, and session content type against the persisted session before reading the body. It sends the bytes to R2 using the session multipart id, persists the returned ETag, and returns the cumulative confirmed-byte count. A duplicate request returns the persisted confirmation without appending a duplicate part.

- [ ] **Step 4: Implement idempotent completion and cancellation**

Completion requires every expected part and ETag. It marks the session finalizing, asks R2 to complete the sorted manifest, then writes the existing `shares` record with the session's stable share id. If R2 reports a closed multipart upload during a retry, use `HeadObject` plus object metadata to distinguish an already-completed upload from an invalid session. Return the already-created share URL for later retries. `DELETE` aborts active R2 uploads and cancels the session; it is safe to repeat.

- [ ] **Step 5: Implement poster and expiry cleanup**

The poster route accepts only PNG/JPEG within the existing poster cap, only after successful media completion, and updates the share/session poster key. Call expiry cleanup before new session creation and cancel each expired R2 multipart upload before releasing its reservation. A poster failure must not unpublish an otherwise complete video share.

- [ ] **Step 6: Audit API boundaries**

Verify every route obtains a session via `getAuth`, scopes D1 data by `userId`, validates body size and media type before R2 writes, never returns R2 credentials or multipart ids to another user, and exposes public media only through the completed `shares` record.

### Task 3: Build the Browser Upload Queue and Recovery Engine

**Files:**
- Create: `lib/share-upload-client.ts`

**Interfaces:**
- Consumes the Task 2 JSON endpoints.
- Produces `createResumableShareUpload`, `resumeResumableShareUpload`, `listPendingResumableShareUploads`, `cancelResumableShareUpload`, `ShareUploadProgress`, and `PendingShareUpload`.

- [ ] **Step 1: Define the IndexedDB queue records**

Create an IndexedDB database/store separate from editor drafts. Each record contains the server upload id, share id, canvas id, canvas signature, media Blob, optional poster Blob, media format/resolution, content type, byte size, current confirmed parts, status, and creation/update timestamps. Store the final encoded Blob before starting part upload.

- [ ] **Step 2: Create a resumable upload session**

`createResumableShareUpload` POSTs media metadata to the create endpoint, persists the returned session and Blob atomically enough for recovery (persist before any part is sent), then delegates to the same resume loop. If the browser cannot persist the Blob, cancel the just-created server session so quota is never stranded.

- [ ] **Step 3: Resume by reconciling server truth**

`resumeResumableShareUpload` fetches server status first, updates IndexedDB with the server-confirmed part list, computes the first missing 8 MiB slice, and uploads only absent parts in order. On a fetch/network error, retry transient failures with capped exponential backoff; stop immediately for authorization, validation, quota, or terminal errors. Wait for `online` before retrying offline failures.

- [ ] **Step 4: Finalize, clean up, and retain recoverable state**

After all parts are confirmed, invoke completion, best-effort upload the persisted poster, return the stable URL, and delete the IndexedDB record only after the completion response is durable. Keep records on cancel/error so the UI can explicitly resume or discard them. Ensure an aborted React operation never deletes a pending server session by itself.

- [ ] **Step 5: Audit local recovery behavior**

Verify an app reload can recover from the local Blob without invoking the video compositor, a response lost after completion returns the same public URL, missing local bytes trigger server cancellation plus an actionable error, and close/reload never sends an unreliable unload cleanup request.

### Task 4: Connect Video Canvas Sharing to the Animate-style UI

**Files:**
- Modify: `components/editor/top-bar/types.ts`
- Modify: `components/editor/top-bar/share-controls.tsx`
- Modify: `components/editor/top-bar/index.tsx`

**Interfaces:**
- Consumes `isVideoSrc`, `exportVideoMedia(..., { asBlob: true })`, `exportAnimationBlob`, and Task 3 uploader APIs.
- Produces a video-aware `ShareDialogState`, byte-progress rendering, and recovery-aware Share behavior.

- [ ] **Step 1: Make a plain video canvas open the Animate-style chooser**

Select animated-media sharing when `isAnimateMode` is true or the active canvas main screenshot is a video. Preserve Animate mode's current exporter. For a non-Animate video canvas, call `exportVideoMedia` with `asBlob: true`, the selected format, target width, FPS, watermark choice, and abort signal. Label the chooser and success toast “Share video” / “Video share link ready” while retaining the MP4/WebM/GIF and HD/Full HD/4K controls.

- [ ] **Step 2: Persist encoded media before upload**

Replace the current animate `FormData` upload with the Task 3 client uploader. Record the canvas signature/settings with the Blob so Share can resume the same output. Keep still-image `captureCanvasForShare` and `POST /api/share` untouched.

- [ ] **Step 3: Render precise upload/recovery progress**

Extend `ShareProgressState` so `uploading` uses confirmed byte count and total byte count. Map it to the final upload segment of the progress bar and show a human-readable byte count. Include labels for reconnecting, retrying, and recovering an earlier upload. Retry must call the same persisted upload id, not re-encode.

- [ ] **Step 4: Recover pending media safely**

On top-bar mount, load pending upload records and reconcile them when the browser is online. When Share is opened for a matching video canvas, reopen the exact saved format/resolution and continue its session. Closing the popover/dialog hides it but does not abort an already-encoded durable upload; only the user-selected cancellation path discards it.

- [ ] **Step 5: Audit UI state transitions**

Confirm static canvases retain their existing Share flow; Animate and video canvases never fall through to a static PNG capture; encode cancellation is separate from resumable-upload recovery; dialog closure cannot delete a session; and complete URL responses update storage and show the existing copy/open controls.

### Task 5: Typecheck and Review the Completed Change

**Files:**
- Modify only files required by Tasks 1–4.

- [ ] **Step 1: Inspect the complete diff for ownership and accidental changes**

Run `git diff --check` and inspect changed-file status. Do not stage or alter existing unrelated user changes.

- [ ] **Step 2: Run the permitted verification command**

Run: `pnpm typecheck`

Expected: exit code 0 with no TypeScript diagnostics. Do not run tests, build, lint, browser, or React Doctor commands without further user permission.

- [ ] **Step 3: Perform a manual security and reliability audit**

Read all new route handlers and upload state transitions against the approved design: authentication, ownership, quota reservation, range validation, R2 reconciliation, idempotent finalization, public visibility, cancellation, expiry, offline retry, and IndexedDB recovery. Fix every issue found before committing.

- [ ] **Step 4: Commit only this feature's files**

Stage only the migration, schema, upload modules, routes, and top-bar files introduced by this plan. Use the short repository commit format: `optimised: video share upload`.
