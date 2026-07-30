import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useBareStageSize } from "@/components/editor/canvas/use-bare-stage-size"

/**
 * jsdom has no layout, so the stage is faked: `clientWidth`/`clientHeight` plus
 * computed padding for the initial synchronous read, and a hand-driven
 * ResizeObserver for the updates a padding drag produces.
 */
const observers = new Set<{
  target: Element | null
  emit: (w: number, h: number) => void
}>()

class FakeResizeObserver {
  private entry = { target: null as Element | null }
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.entry.target = target
    observers.add({
      target,
      emit: (w, h) => {
        this.callback(
          [
            {
              target,
              contentRect: { width: w, height: h },
            } as ResizeObserverEntry,
          ],
          this
        )
      },
    })
  }
  disconnect() {
    for (const o of observers) {
      if (o.target === this.entry.target) observers.delete(o)
    }
  }
  unobserve() {}
}

function makeStage({ box = 1100, padding = 0 } = {}) {
  const el = document.createElement("div")
  el.style.paddingLeft = `${padding}px`
  el.style.paddingRight = `${padding}px`
  el.style.paddingTop = `${padding}px`
  el.style.paddingBottom = `${padding}px`
  Object.defineProperty(el, "clientWidth", { value: box, configurable: true })
  Object.defineProperty(el, "clientHeight", { value: box, configurable: true })
  document.body.appendChild(el)
  return el
}

function emitResize(w: number, h: number) {
  for (const o of observers) o.emit(w, h)
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
})

afterEach(() => {
  observers.clear()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

describe("useBareStageSize", () => {
  it("reports the content box, excluding padding", () => {
    const ref = { current: makeStage({ box: 1100, padding: 40 }) }
    const { result } = renderHook(() => useBareStageSize(ref, true))

    expect(result.current).toEqual({ w: 1020, h: 1020 })
  })

  it("follows a resize, which is how a padding preview reaches the box", () => {
    const ref = { current: makeStage({ box: 1100, padding: 0 }) }
    const { result } = renderHook(() => useBareStageSize(ref, true))

    expect(result.current).toEqual({ w: 1100, h: 1100 })

    act(() => emitResize(843.3, 430.8))
    expect(result.current).toEqual({ w: 843.3, h: 430.8 })
  })

  it("keeps the same object across a no-op resize", () => {
    const ref = { current: makeStage({ box: 800 }) }
    const { result } = renderHook(() => useBareStageSize(ref, true))

    const first = result.current
    act(() => emitResize(800, 800))
    expect(result.current).toBe(first)
  })

  it("ignores a collapsed measurement so the box keeps its last real size", () => {
    const ref = { current: makeStage({ box: 800 }) }
    const { result } = renderHook(() => useBareStageSize(ref, true))

    act(() => emitResize(0, 0))
    expect(result.current).toEqual({ w: 800, h: 800 })
  })

  /** Framed / row / tweet canvases position via container queries instead. */
  it("returns null when disabled, so callers fall back to padding math", () => {
    const ref = { current: makeStage({ box: 800 }) }
    const { result, rerender } = renderHook(
      ({ enabled }) => useBareStageSize(ref, enabled),
      { initialProps: { enabled: true } }
    )

    expect(result.current).not.toBeNull()
    rerender({ enabled: false })
    expect(result.current).toBeNull()
  })

  it("stops observing on unmount", () => {
    const ref = { current: makeStage({ box: 800 }) }
    const { unmount } = renderHook(() => useBareStageSize(ref, true))

    expect(observers.size).toBe(1)
    unmount()
    expect(observers.size).toBe(0)
  })
})
