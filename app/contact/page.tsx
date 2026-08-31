import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DocPage } from "@/components/landing/doc-page"

export const metadata: Metadata = {
  title: "Contact Tokokino",
  description:
    "Get in touch about Tokokino, report a bug, suggest a feature, or ask a private question.",
}

const channels = [
  {
    label: "Project updates",
    value: "@sh17va on X",
    href: "https://x.com/sh17va",
    body: (
      <>
        The quickest way to reach me is on X. I am active there, but I follow{" "}
        <ExternalLink href="https://nohello.net/en/">nohello</ExternalLink>:
        please do not send only &ldquo;hello.&rdquo; Include a short pitch or
        summary so I can quickly understand what you need.
      </>
    ),
  },
  {
    label: "Bugs and contributions",
    value: "GitHub repository",
    href: "https://github.com/ShivaBhattacharjee/tokokino",
    body: "Found a bug, have a feature idea, or want to contribute? GitHub is the best place for it. If you are reporting a bug, share what you expected, what happened instead, and the steps needed to reproduce it. Only attach files that are safe to post publicly.",
  },
  {
    label: "Private support",
    value: "hello@theshiva.xyz",
    href: "mailto:hello@theshiva.xyz",
    body: "Email me if your message should stay private, including account questions, privacy requests, legal notices, or security reports. Please include enough context for me to understand the issue, but never send passwords or authentication tokens.",
  },
] as const

export default function ContactPage() {
  return (
    <DocPage
      eyebrow="Contact"
      title="Questions, ideas, or bugs?"
      summary="The quickest way to reach me is on X, where I am actively available. You can also open an issue on GitHub or email me if your message needs to stay private."
    >
      <article className="w-full">
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60 bg-background/55">
          {channels.map((channel, index) => (
            <section
              key={channel.href}
              className="grid gap-4 p-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-10 sm:p-7"
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
              I&apos;m Shiva, and I build Tokokino from Guwahati, India. I read
              every message myself, so replies may sometimes take a little
              while. A clear subject and a short explanation of what you need
              will help me respond faster.
            </p>
            <p>
              For privacy or account deletion requests, email from the address
              connected to your account when possible. Please report security
              issues privately before opening a public issue. For copyright or
              asset concerns, include the relevant URL and enough information
              for me to review the request.
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
