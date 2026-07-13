import type { Ref } from "react"

/** Assign a DOM node to a React ref (callback or object). */
export function assignMediaRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") ref(value)
  else ref.current = value
}
