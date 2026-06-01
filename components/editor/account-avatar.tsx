"use client"

import * as React from "react"
import { RiUserLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

/**
 * Account avatar that renders the user's image as an <img> with
 * `referrerPolicy="no-referrer"`. Google (lh3.googleusercontent.com) avatars
 * 403/429 when fetched as a CSS `background-image` because the browser sends a
 * referrer — using an <img> with no referrer fixes that. Falls back to a user
 * glyph when there's no image or it fails to load.
 */
export function AccountAvatar({
  src,
  name,
  className,
  iconClassName = "size-4",
}: {
  src?: string | null
  name?: string | null
  className?: string
  iconClassName?: string
}) {
  const [errored, setErrored] = React.useState(false)

  // Reset the error state if the source changes (e.g. login / account switch).
  const [lastSrc, setLastSrc] = React.useState(src)
  if (src !== lastSrc) {
    setLastSrc(src)
    setErrored(false)
  }

  const showImage = Boolean(src) && !errored

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-secondary text-secondary-foreground",
        className
      )}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={name ?? "Account"}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <RiUserLine className={iconClassName} />
      )}
    </span>
  )
}
