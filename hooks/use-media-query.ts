"use client"

import * as React from "react"

/**
 * SSR-safe `matchMedia` subscription. Returns `false` on the server and on the
 * first client render, then the real match after hydration.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [query])

  return matches
}
