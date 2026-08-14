import { describe, expect, it, vi } from "vitest"

import * as Profiler from "@/lib/editor/animation-export/pass-profiler"

describe("animation export pass profiler", () => {
  it("reports interval averages without logging every frame", async () => {
    const report = vi.fn()
    let time = 0
    const create = (
      Profiler as typeof Profiler & {
        createPassProfiler?: (...args: unknown[]) => {
          measure<T>(label: string, task: () => Promise<T>): Promise<T>
          finishFrame(startedAt: number): void
        }
      }
    ).createPassProfiler
    expect(create).toBeTypeOf("function")
    const profiler = create?.(true, {
      interval: 2,
      now: () => time,
      report,
    })

    for (let frame = 0; frame < 2; frame++) {
      const startedAt = time
      await profiler?.measure("chrome", async () => {
        time += 4
      })
      time += 6
      profiler?.finishFrame(startedAt)
    }

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0][0]).toMatchObject({
      frames: 2,
      averageFrameMs: 10,
      passes: { chrome: { calls: 2, averageMs: 4 } },
    })
  })
})
