"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"

function resetWindowScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
}

export function ResetScrollOnNavigate() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    if (pathname === "/app" || pathname.startsWith("/app/")) return
    if (window.location.hash) return

    if (window.history.scrollRestoration !== "manual") {
      window.history.scrollRestoration = "manual"
    }

    resetWindowScroll()
    const frame = window.requestAnimationFrame(resetWindowScroll)
    const timeout = window.setTimeout(resetWindowScroll, 0)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [pathname])

  return null
}
