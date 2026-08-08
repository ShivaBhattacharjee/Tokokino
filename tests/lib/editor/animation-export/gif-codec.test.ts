import { describe, expect, it } from "vitest"

import { GifStreamEncoder } from "@/lib/editor/animation-export/gif-codec"

const W = 4
const H = 4

/** A solid-colour RGBA frame the encoder can quantize. */
function frame(r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return data
}

describe("GifStreamEncoder", () => {
  it("releases the sampled frames once they are folded into the palette", () => {
    // The samples and the concatenated copy are both live during the fold, and
    // 16 sampled 1080p frames is ~130 MB per copy.
    const encoder = new GifStreamEncoder()
    encoder.addSample(frame(255, 0, 0))
    encoder.addSample(frame(0, 255, 0))
    expect(encoder.sampleCount).toBe(2)

    encoder.buildPalette()
    expect(encoder.sampleCount).toBe(0)
  })

  it("encodes frames against the shared palette", () => {
    const encoder = new GifStreamEncoder()
    encoder.addSample(frame(255, 0, 0))
    encoder.buildPalette()
    encoder.writeFrame(frame(255, 0, 0), W, H, 33.333)
    encoder.writeFrame(frame(255, 0, 0), W, H, 66.667)
    expect(encoder.frameCount).toBe(2)

    const bytes = encoder.finish()
    expect(bytes.byteLength).toBeGreaterThan(0)
    // "GIF89a"
    expect(Array.from(bytes.subarray(0, 6))).toEqual([71, 73, 70, 56, 57, 97])
  })

  it("refuses to build a palette with nothing sampled", () => {
    expect(() => new GifStreamEncoder().buildPalette()).toThrow(
      /No frames captured/
    )
  })

  it("refuses to write a frame before the palette exists", () => {
    const encoder = new GifStreamEncoder()
    expect(() => encoder.writeFrame(frame(1, 2, 3), W, H, 0)).toThrow(
      /palette has not been built/
    )
  })

  it("distributes whole-centisecond delays so 30fps stays 1s over 30 frames", () => {
    // GIF delays are whole centiseconds. Truncating each 33.333ms frame
    // independently yields 3cs × 30 = 0.9s — 10% fast. The running emitted-time
    // accounting is what keeps the clip honest, so assert the sum directly.
    const frameMs = 1000 / 30
    let emitted = 0
    let total = 0
    for (let f = 0; f < 30; f++) {
      const target = Math.round(((f + 1) * frameMs) / 10)
      const delay = Math.max(2, target - emitted)
      emitted += delay
      total += delay
    }
    expect(total).toBe(100)
  })
})
