import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DocIndex } from "@/components/landing/doc-index"
import { DocPage } from "@/components/landing/doc-page"

export const metadata: Metadata = {
  title: "Privacy Policy — Tokokino",
  description:
    "Read how Tokokino handles authentication data, shared content, and usage information.",
}

const EFFECTIVE_DATE = "May 20, 2026"

type PolicySection = {
  title: string
  body: ReactNode[]
}

const sections: PolicySection[] = [
  {
    title: "1. Scope",
    body: [
      "This Privacy Policy explains what information Tokokino processes, why it is processed, and the choices available to you when using the website, editor, sharing features, and related services.",
      "Tokokino is an open-source project. Data practices can differ between self-hosted deployments and any official hosted service.",
    ],
  },
  {
    title: "2. Data We Collect",
    body: [
      "Account and identity data: when you sign in, Tokokino may process information provided by your authentication provider, such as name, email address, profile identifier, and avatar.",
      "Shared content data: if you create a public share link, the rendered exported image and related share metadata are stored so the link can be accessed.",
      "Operational data: Tokokino may process technical information required for service reliability and abuse prevention, such as request timestamps, user agent data, IP-derived logs, and error diagnostics.",
      "Editor content is local by default. Screenshots and styling work remain in your browser unless you explicitly upload or share them through a server-backed feature.",
    ],
  },
  {
    title: "3. How We Use Data",
    body: [
      "To authenticate users, maintain sessions, and secure accounts.",
      "To store and deliver shared images when you request public sharing.",
      "To operate, maintain, debug, protect, and improve the service.",
      "To comply with legal obligations and enforce platform safety requirements.",
    ],
  },
  {
    title: "4. Legal Bases",
    body: [
      "Depending on your location, Tokokino processes data under one or more legal bases: performance of a contract (to provide requested features), legitimate interests (security and service reliability), consent (where required), and legal obligations.",
    ],
  },
  {
    title: "5. Sharing and Disclosure",
    body: [
      "Tokokino does not sell your personal data.",
      "Data may be shared with infrastructure providers that support core functionality, including hosting, authentication, and object storage, only as needed to operate the service.",
      "Public share links are accessible to anyone who has the URL. You are responsible for deciding what content you publish through share links.",
      "Data may be disclosed when required by applicable law, legal process, or to protect users, rights, or the service.",
    ],
  },
  {
    title: "6. Retention",
    body: [
      "Account-related information is retained while your account is active and for a limited period afterward where needed for security, compliance, or dispute resolution.",
      "Shared image records are retained until deleted by you, removed by maintainers for policy reasons, or otherwise removed through normal data lifecycle management.",
      "Short-term logs and diagnostic records are retained only as long as reasonably necessary for operational and security needs.",
    ],
  },
  {
    title: "7. Your Choices and Rights",
    body: [
      "You may choose not to use sign-in or sharing features if you prefer to keep all editing fully local.",
      "Where applicable law grants privacy rights, you may request access, correction, deletion, restriction, objection, portability, or withdrawal of consent for specific processing activities.",
      "To submit a privacy request, contact Tokokino using the methods listed in the Terms page and include enough detail to verify and process your request.",
    ],
  },
  {
    title: "8. Security",
    body: [
      "Tokokino uses reasonable technical and organizational safeguards to protect personal information. No method of storage or transmission is completely secure, so absolute security cannot be guaranteed.",
    ],
  },
  {
    title: "9. International Transfers",
    body: [
      "Tokokino services and providers may process data in multiple countries. Where required, reasonable safeguards are used for cross-border processing in line with applicable law.",
    ],
  },
  {
    title: "10. Children's Privacy",
    body: [
      "Tokokino is not intended for children under the minimum age required by applicable law. If you believe a child has provided personal information without proper authorization, contact the project so appropriate action can be taken.",
    ],
  },
  {
    title: "11. Policy Updates",
    body: [
      "This Privacy Policy may be updated from time to time. Material changes will be reflected by updating the effective date and posting the revised policy.",
    ],
  },
  {
    title: "12. Contact",
    body: [
      <>
        For privacy questions or requests, contact the project through{" "}
        <ExternalLink href="https://github.com/shivabhattacharjee/tokokino">
          github.com/shivabhattacharjee/tokokino
        </ExternalLink>{" "}
        or email{" "}
        <ExternalLink href="mailto:hello@theshiva.xyz">
          hello@theshiva.xyz
        </ExternalLink>
        .
      </>,
    ],
  },
]

const indexItems = sections.map((section) => ({
  id: slugify(section.title),
  label: section.title.replace(/^\d+\.\s/, ""),
}))

export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary={
        <>
          How Tokokino handles authentication data, shared content, and usage
          information. Editing stays in your browser unless you sign in or
          share.
          <span className="mt-1 block font-mono text-[10px] tracking-widest text-primary/80 uppercase">
            Effective {EFFECTIVE_DATE}
          </span>
        </>
      }
      index={<DocIndex items={indexItems} />}
    >
      <article className="max-w-2xl space-y-10">
        {sections.map((section) => (
          <section
            key={section.title}
            id={slugify(section.title)}
            className="scroll-mt-8 border-t border-border/50 pt-10"
          >
            <h2 className="text-base font-medium tracking-tight sm:text-lg">
              {section.title}
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/58">
              {section.body.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </article>
    </DocPage>
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
    >
      {children}
    </a>
  )
}
