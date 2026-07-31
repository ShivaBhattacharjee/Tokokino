import type { ReactNode } from "react"

import { FlickeringGrid } from "@/components/ui/flickering-grid"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

type ErrorViewProps = {
  /** Status-ish code shown in the badge, e.g. "500" or "404". */
  code: string
  label: string
  title: ReactNode
  description: ReactNode
  /** Single primary action — keep it to one button. */
  action: ReactNode
  footnote?: ReactNode
}

export function ErrorView({
  code,
  label,
  title,
  description,
  action,
  footnote,
}: ErrorViewProps) {
  return (
    <main className="relative isolate flex min-h-svh flex-col justify-center overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 z-0">
        <FlickeringGrid
          color="rgb(255,255,255)"
          maxOpacity={0.035}
          flickerChance={0.08}
          squareSize={3}
          gridGap={8}
          className="h-full w-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 24%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 26rem), radial-gradient(circle at 80% 74%, color-mix(in oklch, var(--accent-foreground) 16%, transparent), transparent 28rem)",
        }}
      />

      <section className={`relative z-10 ${CONTENT_WIDTH}`}>
        <div className="flex flex-col items-center px-5 py-16 text-center sm:px-8 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1 font-mono text-[10px] tracking-widest uppercase backdrop-blur-sm">
            <span className="text-primary">{code}</span>
            <span className="text-foreground/45">{label}</span>
          </span>

          <h1 className="mt-5 max-w-xl text-[1.35rem] leading-[1.1] font-medium tracking-[-0.035em] text-balance sm:text-[1.75rem] sm:leading-[1.08]">
            {title}
          </h1>

          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-balance text-foreground/55 sm:text-sm">
            {description}
          </p>

          <div className="mt-7">{action}</div>

          {footnote ? (
            <p className="mt-6 font-mono text-[10px] tracking-widest text-foreground/30 uppercase">
              {footnote}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
