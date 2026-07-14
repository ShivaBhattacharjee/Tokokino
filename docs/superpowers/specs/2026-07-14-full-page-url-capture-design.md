# Full-page URL capture design

## Goal

When a user captures a website through Tokokino's URL screenshot flow, capture
the full page and let the user choose the visible vertical section in the
canvas with a mouse wheel or trackpad. The rendered and exported canvas must
show that selected section without a scrollbar.

## Scope

- Applies only to standard website URL captures sent to `/api/screenshot`.
- Does not apply to uploaded images, existing screenshots, video, X/Twitter
  card loading, or Bluesky card loading.
- Works for the main screenshot and additional screenshot slots that use the
  standard URL capture flow.
- Desktop wheel and trackpad input adjusts the selected vertical position.
- Touch input remains unchanged, preserving current iPad selection and drag
  interactions.

## Data model

Add optional full-page capture metadata to main screenshots and screenshot
slots. It records that the image came from a full-page URL capture and stores a
normalized vertical offset. Existing drafts hydrate without the metadata and
continue using the current image behavior.

Replacing, deleting, cropping, or uploading an image clears the metadata.
URL captures initialize it to the page top.

## Server capture

`POST /api/screenshot` will request Cloudflare Browser Rendering with
`fullPage: true` for standard URL captures. The cache key includes the capture
mode so full-page and viewport captures cannot be confused. The response stays
an image, preserving the current client ingestion flow.

## Canvas behavior

Full-page captures render inside the existing screenshot frame/slot clipping
area. Their image is sized to the capture viewport width and vertically
translated by the stored offset; normal `object-fit` behavior remains unchanged
for all other image sources.

The screenshot surface handles non-touch wheel input only when it has
full-page-capture metadata. Wheel events prevent page scrolling only when the
stored offset actually changes; at the top or bottom, normal editor page
scrolling is allowed. No scrollbar is mounted. Pointer and touch interactions
are not repurposed.

## Error handling and compatibility

The existing Cloudflare error mapping, rate limit, timeout, and capture-session
loading UI remain in place. If a full-page screenshot cannot be captured, the
existing error toast is shown and the canvas is unchanged.

## Verification

After implementation, run `pnpm typecheck` only. Per project guidance, do not
run tests, builds, or browser checks unless the user explicitly authorizes
them.
