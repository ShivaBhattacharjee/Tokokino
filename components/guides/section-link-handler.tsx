"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function SectionLinkHandler() {
  useEffect(() => {
    if (window.location.hash) {
      const el = document.getElementById(
        decodeURIComponent(window.location.hash.slice(1))
      )
      el?.scrollIntoView({ block: "start" })
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.("a[data-section-link]")
      if (!(anchor instanceof HTMLAnchorElement)) return

      const url = new URL(
        anchor.getAttribute("href") ?? "",
        window.location.href
      ).toString()
      window.history.replaceState(null, "", anchor.hash)
      try {
        void navigator.clipboard
          ?.writeText(url)
          ?.then(() => toast.success("Section link copied"))
      } catch {
        /* clipboard unavailable — the hash link still works */
      }
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  return null
}
