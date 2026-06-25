import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom lacks ResizeObserver, which Radix primitives (Slider, etc.) use.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserver {
    observe = () => {}
    unobserve = () => {}
    disconnect = () => {}
  }
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserver
}

// jsdom doesn't implement matchMedia, which responsive hooks rely on.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom doesn't implement pointer capture, which Radix Slider calls on the thumb.
if (typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture ??= () => false
  proto.setPointerCapture ??= () => {}
  proto.releasePointerCapture ??= () => {}
  proto.scrollIntoView ??= () => {}
}

// Ensure the DOM is reset between every test so rendered components from one
// test never leak into the next.
afterEach(() => {
  cleanup()
})
