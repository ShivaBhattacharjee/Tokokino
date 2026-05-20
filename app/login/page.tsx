import type { Metadata } from "next"

import LineWaves from "@/components/LineWaves"
import { BrandLogo } from "@/components/editor/brand-logo"

import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in — Tokokino",
  description: "Sign in to Tokokino to save and share your screenshots.",
}

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")"

export default function LoginPage() {
  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      <div className="relative grid min-h-svh w-full lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-black lg:block">
          <div className="absolute inset-0">
            <LineWaves
              speed={0.3}
              innerLineCount={32}
              outerLineCount={36}
              warpIntensity={1.0}
              rotation={-45}
              edgeFadeWidth={0.0}
              colorCycleSpeed={1.0}
              brightness={0.25}
              color1="#ff5b6e"
              color2="#ffffff"
              color3="#ff5b6e"
              enableMouseInteraction
              mouseInfluence={2.0}
            />
          </div>

          <div
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
            aria-hidden
          />

          <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white lg:p-8">
            <BrandLogo className="-ml-3 [&_*]:!text-white" />

            <div className="space-y-7">
              <div className="h-px w-10 bg-[oklch(0.7_0.2_18)]/80" />
              <p className="max-w-[26ch] text-[clamp(1.35rem,1.8vw,1.7rem)] leading-[1.25] font-medium tracking-[-0.02em] text-white">
                Frame the{" "}
                <span className="text-[oklch(0.7_0.2_18)]">ordinary</span> with
                intention.
              </p>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-svh flex-col px-7 py-10 sm:px-14 lg:px-20 lg:py-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay dark:opacity-[0.08]"
            style={{ backgroundImage: GRAIN_SVG }}
            aria-hidden
          />

          <div
            className="pointer-events-none absolute -top-32 -right-32 size-[420px] rounded-full bg-primary/10 blur-[120px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-20 size-[360px] rounded-full bg-accent/40 blur-[120px]"
            aria-hidden
          />

          <div className="relative z-10 lg:hidden">
            <BrandLogo />
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center py-12">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  )
}
