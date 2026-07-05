import { BrandLogo } from "@/components/editor/brand-logo"

// Route-level loading UI for /login — mirrors the page's split layout so the
// shell stays stable while the server component (session check) resolves.
export default function LoginLoading() {
  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      <div className="relative grid min-h-svh w-full lg:grid-cols-[1.05fr_1fr]">
        {/* Left brand panel */}
        <aside className="relative hidden overflow-hidden bg-[oklch(0.985_0_0)] lg:block dark:bg-black">
          <div className="absolute inset-0 animate-pulse bg-linear-to-br from-primary/10 via-transparent to-accent/20" />
          <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-8">
            <BrandLogo />
            <div className="space-y-7">
              <div className="h-px w-10 bg-[oklch(0.7_0.2_18)]/80" />
              <div className="space-y-3">
                <div className="h-6 w-56 animate-pulse rounded-md bg-foreground/10" />
                <div className="h-6 w-40 animate-pulse rounded-md bg-foreground/10" />
              </div>
            </div>
          </div>
        </aside>

        {/* Right form panel */}
        <section className="relative flex min-h-svh flex-col px-7 py-10 sm:px-14 lg:px-20 lg:py-14">
          <div className="relative z-10 lg:hidden">
            <BrandLogo />
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center py-12">
            {/* Matches LoginForm (page variant): eyebrow → heading →
                description → single Google button → terms footer. */}
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-10">
              {/* Heading block */}
              <div className="space-y-5">
                {/* "Sign in" eyebrow */}
                <div className="h-2.5 w-16 animate-pulse rounded bg-foreground/10" />
                {/* "Welcome back." heading */}
                <div className="h-12 w-64 max-w-full animate-pulse rounded-md bg-foreground/10" />
                {/* Description (2 lines) */}
                <div className="space-y-2">
                  <div className="h-4 w-full max-w-[34ch] animate-pulse rounded bg-foreground/10" />
                  <div className="h-4 w-3/5 max-w-[34ch] animate-pulse rounded bg-foreground/10" />
                </div>
              </div>

              {/* Action block */}
              <div className="space-y-4">
                {/* Continue with Google button */}
                <div className="h-[52px] w-full animate-pulse rounded-lg bg-foreground/10" />
                {/* Terms footer */}
                <div className="mx-auto h-3 w-56 animate-pulse rounded bg-foreground/10" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
