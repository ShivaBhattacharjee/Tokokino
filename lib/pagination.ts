export type PageItem = number | "ellipsis"

/**
 * Compact page window shared by every paginated list (Open project dialog,
 * Share library, …): `1 … 4 5 6 … 50`.
 *
 * Always includes the first and last page plus a small neighborhood around the
 * current page, collapsing the gaps to an `"ellipsis"` sentinel.
 */
export function buildPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const current = Math.min(Math.max(1, page), totalPages)
  const items: PageItem[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(totalPages - 1, current + 1)

  if (left > 2) items.push("ellipsis")
  for (let p = left; p <= right; p += 1) items.push(p)
  if (right < totalPages - 1) items.push("ellipsis")
  items.push(totalPages)
  return items
}
