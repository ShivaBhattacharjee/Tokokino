"use client"

import Link from "next/link"
import { RiMailLine } from "@remixicon/react"

import { GithubGlyph, TwitterGlyph } from "@/components/landing/landing-svgs"

const FOOTER_LINKS = [
  { label: "About", href: "/" },
  { label: "Changelog", href: "/changelog" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const

const SOCIAL_LINKS = [
  { label: "X / Twitter", href: "https://x.com/sh17va", icon: TwitterGlyph },
  { label: "GitHub", href: "https://git.new/Tokokino", icon: GithubGlyph },
  { label: "Email", href: "mailto:hello@theshiva.xyz", icon: RiMailLine },
] as const

export function EditorFooter() {
  return (
    <footer className="hidden h-11 shrink-0 items-center justify-between gap-6 border-t border-dashed border-border/70 px-5 md:flex">
      <nav className="flex min-w-0 items-center gap-5">
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            scroll
            className="text-[12px] text-foreground/45 transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-1">
        {SOCIAL_LINKS.map((link) => {
          const Icon = link.icon
          const external = link.href.startsWith("http")
          return (
            <a
              key={link.href}
              href={link.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              aria-label={link.label}
              className="flex size-7 items-center justify-center text-foreground/40 transition-colors hover:text-foreground"
            >
              <Icon className="size-3.5" />
            </a>
          )
        })}
      </div>
    </footer>
  )
}
