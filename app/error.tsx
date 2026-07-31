"use client"

import { useEffect } from "react"
import { RiRefreshLine } from "@remixicon/react"

import { ErrorView } from "@/components/error-view"
import { Button } from "@/components/ui/button"
import { captureError } from "@/lib/analytics"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "route-error" })
  }, [error])

  return (
    <ErrorView
      code="500"
      label="Something broke"
      title="This page stopped rendering."
      description="The issue has been reported to our team. Refresh to try this route again."
      action={
        <Button
          type="button"
          size="lg"
          className="h-9 gap-2 px-4 text-[13px]"
          onClick={reset}
        >
          <RiRefreshLine className="size-4" />
          Refresh
        </Button>
      }
      footnote={error.digest ? `Digest ${error.digest}` : undefined}
    />
  )
}
