import { z } from "zod/v4"

/**
 * Zod schemas for the Unsplash proxy routes.
 *
 * These cover both directions of the trust boundary: the query params we
 * receive from the client (`/api/unsplash/search`, `/api/unsplash/download`)
 * and the JSON shape we get back from the Unsplash API before reshaping it
 * for the client.
 */

const UNSPLASH_API_PREFIX = "https://api.unsplash.com/"

/**
 * Query params for `GET /api/unsplash/search`.
 *
 * Callers should pass `searchParams.get("q") ?? ""` so a missing param
 * fails with the friendly `min` message rather than a type error.
 */
export const unsplashSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Missing search query"),
  // Missing/invalid page falls back to the first page rather than erroring.
  page: z.coerce.number().int().positive().catch(1),
})

/** Query params for `GET /api/unsplash/download`. */
export const unsplashDownloadQuerySchema = z.object({
  url: z
    .url("Missing Unsplash download location")
    .startsWith(UNSPLASH_API_PREFIX, "Missing Unsplash download location"),
})

const unsplashSearchPhotoSchema = z.object({
  id: z.string(),
  alt_description: z.string().nullable(),
  urls: z.object({
    small: z.string(),
    regular: z.string(),
    full: z.string(),
  }),
  user: z.object({
    name: z.string(),
    links: z.object({ html: z.string() }),
  }),
  links: z.object({ download_location: z.string() }),
})

/** Subset of the Unsplash `/search/photos` response we depend on. */
export const unsplashSearchResponseSchema = z.object({
  results: z.array(unsplashSearchPhotoSchema),
  total_pages: z.number(),
})

export type UnsplashSearchResponse = z.infer<
  typeof unsplashSearchResponseSchema
>
