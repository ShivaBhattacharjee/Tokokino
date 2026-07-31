import Link from "next/link"
import { RiHome5Line } from "@remixicon/react"

import { ErrorView } from "@/components/error-view"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <ErrorView
      code="404"
      label="Lost route"
      title="This frame is out of shot."
      description="The page you opened does not exist, moved, or was exported from a route Tokokino no longer serves."
      action={
        <Button asChild size="lg" className="h-9 gap-2 px-4 text-[13px]">
          <Link href="/">
            <RiHome5Line className="size-4" />
            Go home
          </Link>
        </Button>
      }
    />
  )
}
