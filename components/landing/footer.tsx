"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { RiMailLine } from "@remixicon/react"
import { TextHoverEffect } from "@/components/ui/text-hover-effect"
import { GithubGlyph, TwitterGlyph } from "@/components/landing/landing-svgs"
import { ease } from "@/components/landing/constants"
import { DashedH } from "@/components/landing/dashed-h"
import {
  scrollToHash,
  landingSectionHref,
} from "@/components/landing/section-link"

const SOCIAL_LINKS = [
  {
    label: "X / Twitter",
    href: "https://x.com/sh17va",
    icon: TwitterGlyph,
  },
  {
    label: "GitHub",
    href: "https://git.new/Tokokino",
    icon: GithubGlyph,
  },
  {
    label: "Email",
    href: "mailto:hello@theshiva.xyz",
    icon: RiMailLine,
  },
] as const

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "DPA", href: "/dpa" },
    ],
  },
] as const

function FooterColumnHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="px-3.5 text-[15px] text-foreground">{children}</h3>
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string
  children: React.ReactNode
  external?: boolean
}) {
  const pathname = usePathname()
  const className =
    "text-[13px] text-foreground/55 underline decoration-transparent underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"

  if (external || href.startsWith("http") || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        target={href.startsWith("mailto:") ? undefined : "_blank"}
        rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
        className={className}
      >
        {children}
      </a>
    )
  }

  if (href.startsWith("#")) {
    return (
      <Link
        href={landingSectionHref(href, pathname)}
        onClick={(e) => {
          if (pathname !== "/") return
          e.preventDefault()
          scrollToHash(href)
        }}
        className={className}
      >
        {children}
      </Link>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function Footer({ showRail = true }: { showRail?: boolean }) {
  return (
    <footer className="relative w-full px-5 pb-0 sm:px-8 lg:px-12">
      {!showRail && (
        <div aria-hidden className="h-px w-full border-t border-border/70" />
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65, ease }}
        className="relative grid gap-12 pt-14 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:pt-20 xl:gap-10"
      >
        <div className="flex flex-col gap-7">
          <h2 className="text-[1.45rem] leading-[1.12] font-medium tracking-[-0.035em] text-balance sm:text-[1.85rem] lg:text-[2rem]">
            Turn plain captures into polished screenshots, mockups, and animated
            demos in minutes.
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            {SOCIAL_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    link.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  aria-label={link.label}
                  className="flex size-10 items-center justify-center rounded-md border border-border/60 bg-background/40 text-foreground/55 backdrop-blur-sm transition hover:border-primary/45 hover:text-primary"
                >
                  <Icon className="size-4" />
                </a>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:gap-10 lg:max-w-md lg:justify-self-end lg:border-l lg:border-border/70 lg:pl-8 xl:pl-10">
          {FOOTER_COLUMNS.map((column, columnIndex) => (
            <motion.div
              key={column.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: columnIndex * 0.06, ease }}
              className="flex flex-col gap-2.5"
            >
              <FooterColumnHeader>{column.title}</FooterColumnHeader>
              <ul className="flex flex-col gap-2.5 px-3.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {showRail ? (
        <div className="mt-12 sm:mt-14">
          <DashedH />
        </div>
      ) : (
        <div
          aria-hidden
          className="mt-12 h-px w-full border-t border-border/70 sm:mt-14"
        />
      )}

      <div className="h-32 w-full md:h-80">
        <TextHoverEffect text="Tokokino" duration={0.2} />
      </div>
    </footer>
  )
}
