import { describe, expect, it } from "vitest"

import { posterSeekTime } from "@/components/editor/crop-modal"

/**
 * The crop dialog's still preview used to always seek ~0.1s in, so cropping a
 * video six seconds into the timeline framed the handles over the clip's FIRST
 * frame — content that wasn't on screen. It now seeks to the playhead.
 */
describe("posterSeekTime", () => {
  it("seeks to the playhead the user is cropping against", () => {
    expect(posterSeekTime(6.09, 7.1)).toBeCloseTo(6.09, 5)
  })

  it("falls back to a nudge off zero when there is no playhead", () => {
    // Decoding at exactly 0 gives a black frame on some codecs.
    expect(posterSeekTime(0, 7.1)).toBeCloseTo(0.1, 5)
  })

  it("uses half the clip when it is shorter than the nudge", () => {
    expect(posterSeekTime(0, 0.08)).toBeCloseTo(0.04, 5)
  })

  it("never lands on the final boundary, which decodes past the last frame", () => {
    expect(posterSeekTime(7.1, 7.1)).toBeCloseTo(7.09, 5)
    expect(posterSeekTime(99, 7.1)).toBeCloseTo(7.09, 5)
  })

  it("keeps the playhead when the duration is not known yet", () => {
    expect(posterSeekTime(6.09, 0)).toBeCloseTo(6.09, 5)
    expect(posterSeekTime(6.09, Number.NaN)).toBeCloseTo(6.09, 5)
  })

  it("ignores a non-finite or negative playhead", () => {
    expect(posterSeekTime(Number.NaN, 7.1)).toBeCloseTo(0.1, 5)
    expect(posterSeekTime(-3, 7.1)).toBeCloseTo(0.1, 5)
  })
})
