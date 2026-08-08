import { describe, expect, it } from "vitest"

import { parseGradeChain } from "@/lib/editor/animation-export/video-media/frame-grade"

type Rgb = [number, number, number]

/**
 * Run a chain over one colour the way `applyGradeToCanvas` does, so the maths is
 * checked without a real canvas (jsdom has no 2D context).
 */
function grade(chain: string, rgb: Rgb): Rgb {
  const ops = parseGradeChain(chain)
  if (!ops) throw new Error(`chain not parsed: ${chain}`)
  let [r, g, b] = rgb
  for (const op of ops) {
    if (op.kind !== "matrix") continue
    const { m, o } = op.matrix
    const nr = m[0] * r + m[1] * g + m[2] * b + o[0] * 255
    const ng = m[3] * r + m[4] * g + m[5] * b + o[1] * 255
    const nb = m[6] * r + m[7] * g + m[8] * b + o[2] * 255
    r = nr
    g = ng
    b = nb
  }
  return [r, g, b]
}

const near = (actual: Rgb, expected: Rgb, tol = 0.6) => {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], -Math.log10(tol)))
}

describe("parseGradeChain", () => {
  it("returns no ops for an empty chain", () => {
    expect(parseGradeChain("")).toEqual([])
    expect(parseGradeChain("none")).toEqual([])
  })

  it("refuses a chain with a leg it cannot model", () => {
    expect(parseGradeChain("drop-shadow(0 0 4px black)")).toBeNull()
    expect(parseGradeChain("brightness(1.2) url(#x)")).toBeNull()
  })

  it("collapses a run of colour legs into a single matrix", () => {
    const ops = parseGradeChain("brightness(1.1) contrast(0.9) saturate(1.2)")!
    expect(ops).toHaveLength(1)
    expect(ops[0].kind).toBe("matrix")
  })

  it("keeps blur as its own op, in chain order", () => {
    const ops = parseGradeChain("blur(2px) grayscale(1)")!
    expect(ops.map((o) => o.kind)).toEqual(["blur", "matrix"])
    expect(ops[0]).toEqual({ kind: "blur", px: 2 })
  })

  it("drops a zero-width blur and an identity colour run", () => {
    expect(parseGradeChain("blur(0px)")).toEqual([])
    expect(parseGradeChain("brightness(1) saturate(1)")).toEqual([])
  })

  it("reads both percentage and multiplier arguments", () => {
    const pct = grade("brightness(50%)", [200, 100, 40])
    const mult = grade("brightness(0.5)", [200, 100, 40])
    near(pct, mult)
    near(pct, [100, 50, 20])
  })
})

describe("filter maths matches the CSS spec", () => {
  it("brightness scales each channel", () => {
    near(grade("brightness(1.5)", [100, 50, 20]), [150, 75, 30])
  })

  it("contrast pivots around mid grey", () => {
    // c·k + (0.5 − 0.5k) in 0..1 → 127.5 stays put, the rest spreads.
    near(grade("contrast(2)", [127.5, 200, 55]), [127.5, 272.5, -17.5])
  })

  it("invert(1) flips the channel", () => {
    near(grade("invert(1)", [200, 100, 0]), [55, 155, 255])
  })

  it("invert(0.5) collapses everything to mid grey", () => {
    near(grade("invert(0.5)", [200, 100, 0]), [127.5, 127.5, 127.5])
  })

  it("grayscale(1) produces the Rec.709 luma on every channel", () => {
    const luma = 0.2126 * 200 + 0.7152 * 100 + 0.0722 * 50
    near(grade("grayscale(1)", [200, 100, 50]), [luma, luma, luma])
  })

  it("saturate(0) matches grayscale(1)", () => {
    near(
      grade("saturate(0)", [200, 100, 50]),
      grade("grayscale(1)", [200, 100, 50])
    )
  })

  it("leaves grey untouched under saturate and hue-rotate", () => {
    near(grade("saturate(3)", [128, 128, 128]), [128, 128, 128])
    near(grade("hue-rotate(90deg)", [128, 128, 128]), [128, 128, 128])
  })

  it("hue-rotate(0) and hue-rotate(360) are the identity", () => {
    near(grade("hue-rotate(0deg)", [200, 100, 50]), [200, 100, 50])
    near(grade("hue-rotate(360deg)", [200, 100, 50]), [200, 100, 50])
  })

  it("sepia(1) warms a white pixel the way the spec matrix does", () => {
    near(grade("sepia(1)", [255, 255, 255]), [
      255 * 1.351,
      255 * 1.203,
      255 * 0.937,
    ])
  })

  it("an amount of 0 is the identity for every amount filter", () => {
    for (const leg of ["grayscale(0)", "sepia(0)", "invert(0)"]) {
      near(grade(leg, [200, 100, 50]), [200, 100, 50])
    }
  })

  it("composes legs in order, not commutatively", () => {
    const a = grade("brightness(2) contrast(2)", [100, 100, 100])
    const b = grade("contrast(2) brightness(2)", [100, 100, 100])
    expect(a[0]).not.toBeCloseTo(b[0], 1)
    // brightness then contrast: (200/255·2 − 0.5)·255 = 272.5
    near(a, [272.5, 272.5, 272.5])
    // contrast then brightness: ((100/255·2 − 0.5)·2)·255 = 145
    near(b, [145, 145, 145])
  })

  it("matches the full committed chain for a real preset", () => {
    // noir = grayscale(1) contrast(1.35) brightness(0.9)
    const luma = 0.2126 * 200 + 0.7152 * 100 + 0.0722 * 50
    const contrasted = (luma / 255) * 1.35 + (0.5 - 0.5 * 1.35)
    const expected = contrasted * 0.9 * 255
    near(grade("grayscale(1) contrast(1.35) brightness(0.9)", [200, 100, 50]), [
      expected,
      expected,
      expected,
    ])
  })
})
