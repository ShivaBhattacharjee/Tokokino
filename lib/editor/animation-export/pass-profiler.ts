type PassStats = { calls: number; totalMs: number }

export type PassProfileSummary = {
  frames: number
  averageFrameMs: number
  passes: Record<string, { calls: number; averageMs: number }>
}

export type PassProfiler = {
  measure<T>(label: string, task: () => Promise<T>): Promise<T>
  measureSync<T>(label: string, task: () => T): T
  finishFrame(startedAt: number): void
}

type PassProfilerOptions = {
  interval?: number
  now?: () => number
  report?: (summary: PassProfileSummary) => void
}

/**
 * Small rolling profiler for the Safari export pipeline. It is disabled in
 * production and reports only once per interval, so measurement itself never
 * becomes meaningful export work.
 */
export function createPassProfiler(
  enabled: boolean,
  options: PassProfilerOptions = {}
): PassProfiler {
  const interval = Math.max(1, options.interval ?? 30)
  const now = options.now ?? (() => performance.now())
  const report =
    options.report ??
    ((summary: PassProfileSummary) => {
      console.info("[Tokokino export][WebKit] average pass timings", summary)
    })
  let frames = 0
  let frameMs = 0
  const passes = new Map<string, PassStats>()

  const record = (label: string, durationMs: number) => {
    if (!enabled) return
    const previous = passes.get(label) ?? { calls: 0, totalMs: 0 }
    previous.calls++
    previous.totalMs += durationMs
    passes.set(label, previous)
  }

  const flush = () => {
    const passSummary: PassProfileSummary["passes"] = {}
    for (const [label, stats] of passes) {
      passSummary[label] = {
        calls: stats.calls,
        averageMs: Number((stats.totalMs / stats.calls).toFixed(2)),
      }
    }
    report({
      frames,
      averageFrameMs: Number((frameMs / frames).toFixed(2)),
      passes: passSummary,
    })
    frames = 0
    frameMs = 0
    passes.clear()
  }

  return {
    async measure<T>(label: string, task: () => Promise<T>): Promise<T> {
      if (!enabled) return task()
      const startedAt = now()
      try {
        return await task()
      } finally {
        record(label, now() - startedAt)
      }
    },
    measureSync<T>(label: string, task: () => T): T {
      if (!enabled) return task()
      const startedAt = now()
      try {
        return task()
      } finally {
        record(label, now() - startedAt)
      }
    },
    finishFrame(startedAt: number) {
      if (!enabled) return
      frames++
      frameMs += now() - startedAt
      if (frames >= interval) flush()
    },
  }
}
