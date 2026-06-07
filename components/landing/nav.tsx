"use client"

import Link from "next/link"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useTheme } from "next-themes"
import { ArrowRight } from "@/components/landing/landing-svgs"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ease } from "@/components/landing/constants"
import { ThemeToggle } from "@/components/theme-toggle"

const links = [
  { label: "Features", href: "#features" },
  { label: "Comparison", href: "#comparison" },
  { label: "Use cases", href: "#use-cases" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
]

function scrollToHash(href: string) {
  const id = href.slice(1)
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function Nav() {
  const [open, setOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-50 flex h-12 shrink-0 items-center justify-between bg-background/72 px-5 backdrop-blur-xl sm:px-8 lg:px-12"
      >
        <BrandLogo />

        {/* Desktop links */}
        <div className="hidden items-center gap-1 font-mono text-xs text-foreground/60 xl:flex">
          {links.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToHash(link.href)
                }}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* Desktop right */}
        <div className="hidden items-center gap-3 xl:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3.5 py-1.5 text-[12px] font-medium text-foreground/70 transition hover:border-foreground/40 hover:text-foreground"
          >
            Sign in
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/app"
            className="group inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start editing
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="relative flex size-9 flex-col items-center justify-center gap-[5px] xl:hidden"
        >
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
        </button>
      </motion.nav>

      {/* Mobile fullscreen menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease }}
            className="fixed inset-x-0 top-12 bottom-0 z-40 flex flex-col overflow-y-auto px-7 pt-8 pb-12 xl:hidden"
            style={{
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              backgroundColor:
                "color-mix(in oklch, var(--background) 58%, transparent)",
            }}
          >
            <nav className="flex flex-col gap-1">
              {links.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: i * 0.06, ease }}
                >
                  {link.href.startsWith("#") ? (
                    <a
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault()
                        setOpen(false)
                        setTimeout(() => scrollToHash(link.href), 50)
                      }}
                      className="block py-1 font-mono text-4xl font-bold tracking-tight text-foreground/80 uppercase transition-colors hover:text-primary sm:text-5xl"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block py-1 font-mono text-4xl font-bold tracking-tight text-foreground/80 uppercase transition-colors hover:text-primary sm:text-5xl"
                    >
                      {link.label}
                    </Link>
                  )}
                </motion.div>
              ))}
            </nav>

            {/* Bottom CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{
                duration: 0.3,
                delay: links.length * 0.06 + 0.05,
                ease,
              }}
              className="mt-auto flex flex-col gap-3"
            >
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 transition hover:border-foreground/40"
              >
                <span className="font-mono text-sm font-bold text-foreground/70 uppercase">
                  Theme
                </span>
                <span className="pointer-events-none">
                  <ThemeToggle />
                </span>
              </button>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 py-4 font-mono text-lg font-bold text-foreground/70 uppercase transition hover:border-foreground/40 hover:text-foreground"
              >
                Sign in
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-mono text-lg font-bold text-primary-foreground uppercase transition hover:opacity-90"
              >
                Start editing
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
