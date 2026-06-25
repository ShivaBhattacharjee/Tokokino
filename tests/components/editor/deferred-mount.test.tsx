import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DeferredMount } from "@/components/editor/deferred-mount"

/**
 * `DeferredMount` — shows `fallback` until after the initial paint, then mounts
 * `children`. Props: children, fallback, priority. Uses requestIdleCallback
 * when available, otherwise a double-rAF + setTimeout(priority * 60ms) stagger.
 */

const Fallback = () => <div data-testid="fallback">loading</div>
const Child = () => <div data-testid="child">ready</div>

afterEach(() => {
  // Remove any requestIdleCallback shim a test installed.
  delete (window as { requestIdleCallback?: unknown }).requestIdleCallback
  delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback
})

describe("DeferredMount", () => {
  it("shows the fallback before the deferred mount", () => {
    render(
      <DeferredMount fallback={<Fallback />}>
        <Child />
      </DeferredMount>
    )
    expect(screen.getByTestId("fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("child")).not.toBeInTheDocument()
  })

  it("eventually mounts children via the rAF fallback path", async () => {
    render(
      <DeferredMount fallback={<Fallback />}>
        <Child />
      </DeferredMount>
    )
    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument())
    expect(screen.queryByTestId("fallback")).not.toBeInTheDocument()
  })

  it("mounts children using requestIdleCallback when available", async () => {
    let called = false
    ;(
      window as unknown as { requestIdleCallback: unknown }
    ).requestIdleCallback = (cb: () => void) => {
      called = true
      cb()
      return 1
    }
    ;(window as unknown as { cancelIdleCallback: unknown }).cancelIdleCallback =
      () => {}

    const { unmount } = render(
      <DeferredMount fallback={<Fallback />}>
        <Child />
      </DeferredMount>
    )

    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument())
    expect(called).toBe(true)

    // Unmount while the shims still exist so the cleanup can call
    // cancelIdleCallback before afterEach removes it.
    unmount()
  })

  it("still mounts children when a priority stagger is applied", async () => {
    render(
      <DeferredMount priority={2} fallback={<Fallback />}>
        <Child />
      </DeferredMount>
    )
    await waitFor(
      () => expect(screen.getByTestId("child")).toBeInTheDocument(),
      { timeout: 1000 }
    )
  })
})
