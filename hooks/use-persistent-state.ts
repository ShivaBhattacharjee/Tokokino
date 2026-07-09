"use client"

import * as React from "react"

/**
 * useState that persists to localStorage under `key`. SSR-safe: reads lazily on
 * the client only, so the first server render uses `fallback` and hydration is
 * stable. Used for sticky UI preferences (e.g. the chosen export format) that
 * should survive reloads.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(fallback)

  // Hydrate from localStorage after mount (avoids SSR/client mismatch).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw == null) return
      const parsed = JSON.parse(raw) as unknown
      if (!isValid || isValid(parsed)) setValue(parsed as T)
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    // Only on mount for this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  }, [key, value])

  return [value, setValue]
}
