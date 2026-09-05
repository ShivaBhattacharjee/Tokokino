import Link from "next/link"
import { RiArrowRightLine, RiHome5Line } from "@remixicon/react"

import { NotFoundBackground } from "@/components/not-found-background"
import { NotFoundArtwork } from "@/components/not-found-artwork"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-svh items-center overflow-hidden bg-background text-foreground">
      <NotFoundBackground />

      <section
        aria-labelledby="not-found-heading"
        className="mx-auto grid w-full max-w-[64rem] items-center justify-center gap-8 px-6 py-16 sm:px-10 md:grid-cols-[minmax(0,28rem)_minmax(0,24rem)] md:gap-12 md:py-24 lg:gap-16"
      >
        <div className="mx-auto w-full max-w-[28rem]">
          <NotFoundArtwork />
        </div>

        <div className="mx-auto w-full max-w-sm md:mx-0">
          <p className="mb-5 font-mono text-[10px] tracking-[0.24em] text-foreground/45 uppercase">
            404 / Lost route
          </p>
          <h1
            id="not-found-heading"
            className="max-w-sm text-3xl leading-[1.1] font-medium tracking-[-0.035em] text-balance sm:text-4xl"
          >
            This frame is out of shot.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-foreground/55 sm:text-base">
            The page you’re looking for has moved or no longer exists. Let’s get
            you back to creating.
          </p>

          <nav
            aria-label="404 recovery resources"
            className="mt-8 flex flex-wrap gap-3"
          >
            <Button
              asChild
              size="lg"
              className="strawberry-button h-10 gap-2 px-5 text-sm"
            >
              <Link href="/">
                <RiHome5Line className="size-4" />
                Go home
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-10 gap-2 bg-background/40 px-5 text-sm"
            >
              <Link href="/app">
                Open editor
                <RiArrowRightLine className="size-4" />
              </Link>
            </Button>
          </nav>
          <div className="mt-6 flex gap-5 text-xs text-foreground/45">
            <Link
              href="/sitemap.xml"
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Sitemap
            </Link>
            <Link
              href="/llms.txt"
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Agent guide
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
