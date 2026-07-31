"use client"

import { useEffect } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { RiRefreshLine } from "@remixicon/react"

import { ErrorView } from "@/components/error-view"
import { Button } from "@/components/ui/button"
import { captureError } from "@/lib/analytics"
import { cn } from "@/lib/utils"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "global-error" })
  }, [error])

  return (
    <html
      lang="en"
      className={cn(
        "dark antialiased",
        fontSans.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <ErrorView
          code="500"
          label="Render interrupted"
          title="The canvas hit an unexpected error."
          description="The issue has been reported to our team. Refresh to pick up where you left off."
          action={
            <Button
              type="button"
              size="lg"
              className="h-9 gap-2 px-4 text-[13px]"
              onClick={() => window.location.reload()}
            >
              <RiRefreshLine className="size-4" />
              Refresh
            </Button>
          }
          footnote={error.digest ? `Digest ${error.digest}` : undefined}
        />
      </body>
    </html>
  )
}
