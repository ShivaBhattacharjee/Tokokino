import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DocPage } from "@/components/landing/doc-page"

export const metadata: Metadata = {
  title: "Contact Tokokino",
  description:
    "Contact the Tokokino project for private support, bug reports, feature requests, contributions, privacy questions, or legal notices.",
}

const channels = [
  {
    label: "Private support",
    value: "hello@theshiva.xyz",
    href: "mailto:hello@theshiva.xyz",
    body: "Use email for account-specific questions, privacy requests, legal notices, security details, or anything that should not be posted publicly. Include the affected page or feature and enough context to understand the request, but do not send passwords, authentication tokens, or unnecessary sensitive information.",
  },
  {
    label: "Bugs and contributions",
    value: "GitHub repository",
    href: "https://github.com/ShivaBhattacharjee/tokokino",
    body: "GitHub is the best place for reproducible bugs, feature proposals, documentation corrections, and code contributions. Search existing issues first when possible. For a bug, include the browser, operating system, steps to reproduce, expected result, actual result, and a small sample file only when it is safe to share publicly.",
  },
  {
    label: "Project updates",
    value: "@sh17va on X",
    href: "https://x.com/sh17va",
    body: "Use X for public project conversation and updates. It is not the right channel for private account, privacy, copyright, or security information; email is preferred for those topics, and GitHub is preferred when a technical report needs details that other contributors can follow.",
  },
] as const

export default function ContactPage() {
  return (
    <DocPage
      eyebrow="Contact"
      title="Choose the channel that fits the message."
      summary="Tokokino is an independent open-source project. These routes reach the maintainer without requiring a public phone number, street address, or support form."
    >
      <article className="max-w-3xl">
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60 bg-background/55">
          {channels.map((channel, index) => (
            <section
              key={channel.href}
              className="grid gap-4 p-6 sm:grid-cols-[9rem_1fr] sm:gap-8 sm:p-7"
            >
              <div>
                <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-sm font-medium tracking-tight">
                  {channel.label}
                </h2>
              </div>
              <div>
                <ExternalLink href={channel.href}>{channel.value}</ExternalLink>
                <p className="mt-3 text-sm leading-7 text-foreground/58">
                  {channel.body}
                </p>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 border-t border-border/50 pt-8">
          <h2 className="text-base font-medium tracking-tight">
            What to expect
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/58">
            <p>
              Tokokino is maintained as a personal project from Guwahati, Assam,
              India, so support is handled directly rather than through a
              staffed service desk. Messages are reviewed as availability
              permits. A clear subject, a direct description of the outcome you
              need, and a safe reproduction case make it easier to respond.
            </p>
            <p>
              For privacy or account deletion requests, write from the email
              associated with the account when possible and identify the request
              precisely. For suspected security issues, email details privately
              before opening a public issue. For copyright or asset concerns,
              include the specific URL, the work involved, your relationship to
              it, and supporting evidence that can be reviewed.
            </p>
          </div>
        </section>
      </article>
    </DocPage>
  )
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const external = href.startsWith("http")

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="inline-flex font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
    >
      {children}
    </a>
  )
}
