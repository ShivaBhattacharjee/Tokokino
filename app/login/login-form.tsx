"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function LoginForm({
  callbackURL = "/app",
  variant = "page",
}: {
  callbackURL?: string
  variant?: "page" | "dialog"
}) {
  const [loading, setLoading] = React.useState(false)

  const handleGoogle = async () => {
    if (loading) return
    setLoading(true)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
    })
    if (error) {
      toast.error(error.message ?? "Google sign-in failed")
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[420px] flex-col",
        variant === "dialog" ? "gap-6" : "gap-10"
      )}
    >
      <div
        className={cn(
          variant === "dialog" ? "space-y-3" : "space-y-5",
          "[&>*]:animate-in [&>*]:fade-in-0 [&>*]:slide-in-from-bottom-2",
          "[&>*]:duration-700 [&>*]:fill-mode-both"
        )}
      >
        <span className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          <span className="text-primary">Sign in</span>
        </span>

        <h1
          className={cn(
            "leading-[1.02] font-semibold tracking-[-0.035em] text-foreground",
            variant === "dialog"
              ? "text-[clamp(1.75rem,8vw,2.35rem)]"
              : "text-[clamp(2.25rem,4.5vw,3.25rem)]"
          )}
          style={{ animationDelay: "140ms" }}
        >
          {variant === "dialog" ? "Sign in" : "Welcome"}{" "}
          <span className="text-primary">
            {variant === "dialog" ? "required." : "back."}
          </span>
        </h1>

        <p
          className="max-w-[38ch] text-sm leading-relaxed text-muted-foreground"
          style={{ animationDelay: "220ms" }}
        >
          {variant === "dialog"
            ? "Use your account to save and share your screenshot work."
            : "One step from turning ordinary captures into something worth framing."}
        </p>
      </div>

      <div
        className="animate-in space-y-4 duration-700 fade-in-0 fill-mode-both slide-in-from-bottom-2"
        style={{ animationDelay: "320ms" }}
      >
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={loading}
          className={cn(
            "group relative flex w-full items-center justify-between overflow-hidden",
            "rounded-lg border border-border bg-card px-4 py-3.5",
            "text-left transition-all duration-300",
            "hover:border-primary/40 hover:bg-card/80",
            "active:translate-y-px",
            "disabled:cursor-wait disabled:opacity-60",
            "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          )}
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/[0.07] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

          <span className="relative flex items-center gap-3">
            <GoogleMark />
            <span className="text-sm font-medium text-foreground">
              {loading ? "Connecting…" : "Continue with Google"}
            </span>
          </span>

          <ArrowGlyph className="relative text-primary transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          By signing in you agree to our{" "}
          <Link
            href="/terms"
            className="underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary/50"
          >
            Terms &amp; Conditions
          </Link>{" "}
        </p>
      </div>
    </div>
  )
}

function ArrowGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 12"
      fill="none"
      aria-hidden
      className={cn("h-2.5 w-6", className)}
    >
      <path
        d="M1 6h21m0 0L17 1m5 5l-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GoogleMark() {
  return (
    <span className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background">
      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.2s2.69-6.2 6-6.2c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.16 14.65 2.2 12 2.2 6.86 2.2 2.7 6.36 2.7 11.5S6.86 20.8 12 20.8c6.93 0 9.54-4.86 9.54-7.45 0-.5-.05-.88-.12-1.25H12z"
        />
        <path
          fill="#34A853"
          d="M3.88 7.36 6.96 9.6c.84-1.94 2.83-3.4 5.04-3.4 1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.16 14.65 2.2 12 2.2 8.18 2.2 4.88 4.34 3.88 7.36z"
        />
        <path
          fill="#FBBC05"
          d="M12 20.8c2.6 0 4.79-.86 6.39-2.34l-2.96-2.42c-.82.57-1.92 1-3.43 1-2.66 0-4.91-1.79-5.71-4.21l-3.07 2.36C4.83 18.68 8.13 20.8 12 20.8z"
        />
        <path
          fill="#4285F4"
          d="M21.54 12.1c0-.5-.05-.88-.12-1.25H12v3.9h5.5c-.22 1.27-1.39 3.07-3.5 3.9l2.96 2.42c1.79-1.65 2.96-4.1 2.96-7.07z"
        />
      </svg>
    </span>
  )
}
