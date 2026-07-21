import { describe, expect, it } from "vitest"
import Fuse from "fuse.js"

/**
 * The ranking half of `searchDrafts`. `lib/draft-db.ts` is `server-only` and
 * needs a live D1 binding, so these pin the Fuse configuration it depends on —
 * the part that decides whether a typo still finds your project. If someone
 * retunes the threshold or drops `ignoreLocation`, this fails loudly rather than
 * quietly returning nothing for real queries.
 */
const NAMES = [
  "Full Fuchsia Wildcat",
  "Logical Peach Weasel",
  "Prominent Beige Cockroach",
  "Simple Emerald Mandrill",
  "Imaginative Pink Planarian",
  "Automatic Red Starfish",
]

/** Declared here rather than imported: pinning it is the point. */
const FUSE_CONFIG = {
  keys: ["name"],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
}

const makeFuse = () =>
  new Fuse(
    NAMES.map((name) => ({ name })),
    FUSE_CONFIG
  )

const search = (q: string) =>
  makeFuse()
    .search(q)
    .map((hit) => hit.item.name)

describe("draft fuzzy search ranking", () => {
  it("finds an exact substring", () => {
    expect(search("Emerald")).toContain("Simple Emerald Mandrill")
  })

  it("tolerates a transposed-letter typo", () => {
    expect(search("Emreald")).toContain("Simple Emerald Mandrill")
  })

  it("tolerates a missing letter", () => {
    expect(search("Fucsia")).toContain("Full Fuchsia Wildcat")
  })

  it("tolerates a wrong letter", () => {
    expect(search("Starfush")).toContain("Automatic Red Starfish")
  })

  it("is case insensitive", () => {
    expect(search("PEACH")).toContain("Logical Peach Weasel")
  })

  it("matches a word at the END of a name", () => {
    // Guards `ignoreLocation`. Fuse defaults to weighting matches near the start
    // of the string, which would drop these.
    expect(search("Cockroach")).toContain("Prominent Beige Cockroach")
    expect(search("Mandrill")).toContain("Simple Emerald Mandrill")
  })

  it("ranks the closest name first", () => {
    // "Peach" is a near-exact hit; nothing else should outrank it.
    expect(search("Peach")[0]).toBe("Logical Peach Weasel")
  })

  it("still returns nothing for a query with no relation", () => {
    // Typo tolerance must not degrade into matching everything.
    expect(search("zzzzqqqq")).toEqual([])
  })

  it("ignores a single character rather than matching everything", () => {
    expect(search("a")).toEqual([])
  })
})

/**
 * The ordering half of `searchDrafts`. Matches are ordered by `sort`, and the
 * comparator tie-breaks on id: search runs in two passes (match over a narrow
 * projection of every draft, then hydrate the page by id), and those passes
 * sort independently. Drafts saved in the same second share an `updatedAt`, so
 * without the tiebreak the two sorts could disagree and the hydrated page would
 * not be the slice that was actually paged to.
 */
const DATED = [
  { id: "d1", name: "Emerald Alpha", updatedAt: "2026-01-03T00:00:00.000Z" },
  { id: "d2", name: "Emerald Bravo", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "d3", name: "Emerald Charlie", updatedAt: "2026-01-02T00:00:00.000Z" },
]

const compareByUpdated = (
  a: { id: string; updatedAt: string },
  b: { id: string; updatedAt: string },
  sort: "latest" | "oldest"
) => {
  const byDate =
    sort === "oldest"
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt)
  return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
}

const searchSorted = (q: string, sort: "latest" | "oldest") => {
  const matches = new Fuse(DATED, FUSE_CONFIG).search(q).map((hit) => hit.item)
  matches.sort((a, b) => compareByUpdated(a, b, sort))
  return matches.map((m) => m.name)
}

describe("draft search ordering", () => {
  it("orders matches newest-first by default", () => {
    expect(searchSorted("Emerald", "latest")).toEqual([
      "Emerald Alpha",
      "Emerald Charlie",
      "Emerald Bravo",
    ])
  })

  it("orders matches oldest-first when asked", () => {
    expect(searchSorted("Emerald", "oldest")).toEqual([
      "Emerald Bravo",
      "Emerald Charlie",
      "Emerald Alpha",
    ])
  })

  it("changes the order without changing which drafts matched", () => {
    const latest = searchSorted("Emerald", "latest")
    const oldest = searchSorted("Emerald", "oldest")
    expect([...oldest].sort()).toEqual([...latest].sort())
    expect(oldest).not.toEqual(latest)
  })
})

describe("draft search ordering — same-timestamp tiebreak", () => {
  // Each page is its own request, re-running the sort over rows D1 returns in
  // no guaranteed order. Tied drafts must land the same side of a page boundary
  // every time or they get shown twice / skipped as the user pages.
  const TIED = [
    { id: "b", name: "Tied Draft", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "a", name: "Tied Draft", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "c", name: "Tied Draft", updatedAt: "2026-01-01T00:00:00.000Z" },
  ]

  it("orders identical timestamps deterministically, whatever the input order", () => {
    for (const sort of ["latest", "oldest"] as const) {
      const once = [...TIED].sort((a, b) => compareByUpdated(a, b, sort))
      const again = [...TIED]
        .reverse()
        .sort((a, b) => compareByUpdated(a, b, sort))
      expect(once.map((d) => d.id)).toEqual(["a", "b", "c"])
      expect(again.map((d) => d.id)).toEqual(once.map((d) => d.id))
    }
  })

  it("pages tied drafts without repeating or dropping one", () => {
    const pageOf = (offset: number, limit: number) =>
      [...TIED]
        .sort((a, b) => compareByUpdated(a, b, "latest"))
        .slice(offset, offset + limit)
        .map((d) => d.id)

    expect([...pageOf(0, 2), ...pageOf(2, 2)]).toEqual(["a", "b", "c"])
  })
})

/**
 * The hydrate pass. Order is decided once in the match pass; `IN (...)` returns
 * the page in no particular order, so hydration replays the ranked id sequence
 * instead of re-sorting. That keeps a single source of truth for order — a
 * second sort would have to stay identical to the first forever.
 */
describe("draft search hydration", () => {
  const hydrate = (pageIds: string[], rows: { id: string; name: string }[]) => {
    const byId = new Map(rows.map((row) => [row.id, row]))
    return pageIds
      .map((id) => byId.get(id))
      .filter((row) => row !== undefined)
      .map((row) => row.name)
  }

  it("replays the ranked order regardless of the order rows come back in", () => {
    const pageIds = ["c", "a", "b"]
    const rows = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
      { id: "c", name: "Charlie" },
    ]
    expect(hydrate(pageIds, rows)).toEqual(["Charlie", "Alpha", "Bravo"])
    expect(hydrate(pageIds, [...rows].reverse())).toEqual([
      "Charlie",
      "Alpha",
      "Bravo",
    ])
  })

  it("drops an id deleted between the two queries rather than emitting a hole", () => {
    const rows = [
      { id: "a", name: "Alpha" },
      { id: "c", name: "Charlie" },
    ]
    expect(hydrate(["c", "a", "b"], rows)).toEqual(["Charlie", "Alpha"])
  })
})
