"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { useTheme } from "next-themes"
import { ArrowRight } from "@/components/landing/landing-svgs"
import { BrandLogo } from "@/components/editor/brand-logo"
import { ease } from "@/components/landing/constants"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import {
  scrollToHash,
  landingSectionHref,
} from "@/components/landing/section-link"
import { ThemeToggle } from "@/components/theme-toggle"

const links = [
  { label: "Features", href: "#features" },
  { label: "Templates", href: "#templates" },
  { label: "Comparison", href: "#comparison" },
  { label: "Use cases", href: "#use-cases" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
]

/**
 * False on the server and through hydration, true on the client — the gate the
 * portal needs, without the extra render a mount effect costs.
 */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function Nav() {
  const pathname = usePathname()
  const showRails = pathname === "/"
  const [open, setOpen] = useState(false)
  const mounted = useMounted()
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // Portal out of the landing page's filtered motion wrapper — `filter` makes
  // position:fixed relative to that tall container, so CTAs sat below the fold.
  const mobileMenu =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease }}
            className="fixed inset-x-0 top-12 bottom-0 z-[60] flex flex-col bg-background xl:hidden"
          >
            <div
              className="mx-auto flex h-full min-h-0 w-full max-w-[76rem] flex-col px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12"
              style={showRails ? RAIL_V_STYLE : undefined}
            >
              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="flex flex-col gap-0.5 pb-3">
                  {links.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25, delay: i * 0.06, ease }}
                    >
                      {link.href.startsWith("#") ? (
                        <Link
                          href={landingSectionHref(link.href, pathname)}
                          onClick={(e) => {
                            setOpen(false)
                            if (pathname !== "/") return
                            e.preventDefault()
                            setTimeout(() => scrollToHash(link.href), 50)
                          }}
                          className="block py-1.5 font-mono text-[1.65rem] leading-tight font-bold tracking-tight text-foreground/80 uppercase transition-colors hover:text-primary sm:text-4xl"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <Link
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="block py-1.5 font-mono text-[1.65rem] leading-tight font-bold tracking-tight text-foreground/80 uppercase transition-colors hover:text-primary sm:text-4xl"
                        >
                          {link.label}
                        </Link>
                      )}
                    </motion.div>
                  ))}
                </div>
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{
                  duration: 0.3,
                  delay: links.length * 0.06 + 0.05,
                  ease,
                }}
                className="flex shrink-0 flex-col gap-2.5 border-t border-border/40 pt-4"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggleTheme}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggleTheme()
                    }
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/70 px-4 py-3 transition hover:border-foreground/40"
                >
                  <span className="font-mono text-sm font-bold text-foreground/70 uppercase">
                    Theme
                  </span>
                  <span className="pointer-events-none">
                    <ThemeToggle />
                  </span>
                </div>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 py-3.5 font-mono text-base font-bold text-foreground/70 uppercase transition hover:border-foreground/40 hover:text-foreground"
                >
                  Sign in
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-mono text-base font-bold text-primary-foreground uppercase transition hover:opacity-90"
                >
                  Start editing
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )

  return (
    <>
      <motion.nav
        initial={showRails ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-50 flex h-12 w-full shrink-0 items-center justify-between px-5 sm:px-8 lg:px-12"
      >
        <BrandLogo />

        {/* Desktop links */}
        <div className="hidden items-center gap-1 font-mono text-xs text-foreground/60 xl:flex">
          {links.map((link) =>
            link.href.startsWith("#") ? (
              <Link
                key={link.href}
                href={landingSectionHref(link.href, pathname)}
                onClick={(e) => {
                  if (pathname !== "/") return
                  e.preventDefault()
                  scrollToHash(link.href)
                }}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </Link>
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
          aria-expanded={open}
          className="relative z-[70] flex size-9 flex-col items-center justify-center gap-[5px] xl:hidden"
        >
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
          <span className="block h-[1.5px] w-5 rounded-full bg-foreground" />
        </button>
      </motion.nav>

      {mobileMenu}
    </>
  )
}
