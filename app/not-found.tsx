import Link from "next/link"
import {
  RiEditLine,
  RiFileList3Line,
  RiHome5Line,
  RiRobot2Line,
} from "@remixicon/react"

import { ErrorView } from "@/components/error-view"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <ErrorView
      code="404"
      label="Lost route"
      layout="split"
      title="This frame is out of shot."
      description="The page you opened does not exist, moved, or was exported from a route Tokokino no longer serves."
      action={
        <nav
          aria-label="404 recovery resources"
          className="grid w-[min(22rem,calc(100vw-2.5rem))] grid-cols-2 gap-2"
        >
          <Button asChild size="lg" className="h-9 gap-2 px-4 text-[13px]">
            <Link href="/">
              <RiHome5Line className="size-4" />
              Go home
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-9 gap-2 px-4 text-[13px]"
          >
            <Link href="/app">
              <RiEditLine className="size-4 text-foreground/55" />
              Open editor
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-9 gap-2 px-4 text-[13px]"
          >
            <Link href="/sitemap.xml">
              <RiFileList3Line className="size-4 text-foreground/55" />
              Sitemap
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-9 gap-2 px-4 text-[13px]"
          >
            <Link href="/llms.txt">
              <RiRobot2Line className="size-4 text-foreground/55" />
              Agent guide
            </Link>
          </Button>
        </nav>
      }
    />
  )
}
