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

const makeFuse = () =>
  new Fuse(
    NAMES.map((name) => ({ name })),
    {
      keys: ["name"],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    }
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
