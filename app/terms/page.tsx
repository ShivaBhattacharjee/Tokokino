import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { BrandLogo } from "@/components/editor/brand-logo"

import { TermsIndex } from "./terms-index"

export const metadata: Metadata = {
  title: "Terms & Conditions — Tokokino",
  description: "Review the terms governing access to and use of Tokokino.",
}

const EFFECTIVE_DATE = "May 17, 2026"

type TermsSection = {
  title: string
  body: ReactNode[]
}

const sections: TermsSection[] = [
  {
    title: "1. Acceptance of Terms",
    body: [
      "These Terms govern your access to and use of Tokokino, including the website, editor, authentication features, sharing tools, export functionality, source code, and related project materials made available by the Tokokino project. By accessing or using Tokokino, signing in, uploading content, or interacting with the project or hosted service, you agree to these Terms.",
      "Tokokino is presented as an open-source software project and is not described here as a private limited company or similar corporate entity. If you do not agree to these Terms, you must not access or use the Service.",
    ],
  },
  {
    title: "2. Eligibility and Accounts",
    body: [
      "You must be at least 13 years old, or the minimum age required in your jurisdiction, to use the Service. You are responsible for ensuring that your use of the Service is lawful in the jurisdiction from which you access it.",
      "When you sign in using Google or another supported authentication provider, you authorize Tokokino to receive and process the account information made available by that provider for authentication and account management. You are responsible for maintaining the confidentiality and security of your account credentials and for all activity occurring under your account.",
    ],
  },
  {
    title: "3. Description of the Service",
    body: [
      "Tokokino provides tools for creating, styling, framing, exporting, saving, and sharing screenshot-based visuals. Features may include device mockups, browser frames, backgrounds, effects, image uploads, export tools, and public or private sharing workflows.",
      "The project and any hosted Service may evolve over time. Features, integrations, and availability may be added, changed, suspended, or discontinued at any time, subject to applicable law.",
    ],
  },
  {
    title: "4. User Content and License",
    body: [
      "You retain ownership of screenshots, images, text, metadata, designs, and other materials that you upload, create, submit, store, or share through the Service (User Content). You are solely responsible for your User Content and for obtaining all rights, permissions, licenses, consents, and clearances necessary to use it with the Service.",
      "By using the Service, you grant Tokokino a limited, worldwide, non-exclusive, royalty-free license to host, store, reproduce, process, display, transmit, and otherwise use your User Content only as necessary to operate, maintain, secure, improve, and provide the Service to you and to others with whom you choose to share content.",
      "You represent and warrant that your User Content does not infringe, misappropriate, or violate any copyright, trademark, design right, patent, privacy, publicity, contractual, confidentiality, or other rights of any third party, and does not violate applicable law.",
    ],
  },
  {
    title: "5. Acceptable Use",
    body: [
      "You agree not to misuse the Service or assist anyone else in doing so. Prohibited conduct includes attempting to gain unauthorized access to the Service or related systems, interfering with Service availability or security, introducing malware or harmful code, reverse engineering restricted components, scraping or harvesting data without authorization, or using the Service to violate applicable law.",
      "You must not upload, create, publish, or share content that is unlawful, defamatory, fraudulent, deceptive, abusive, harassing, hateful, sexually exploitative, invasive of privacy, infringing, or otherwise harmful. Tokokino may remove or restrict access to content or accounts where it reasonably believes these Terms have been violated.",
    ],
  },
  {
    title: "6. Intellectual Property",
    body: [
      <>
        Except for your User Content and third-party materials, the Tokokino
        source code and project materials are made available under the{" "}
        <ExternalLink href="https://www.gnu.org/licenses/agpl-3.0.en.html">
          AGPL-3.0
        </ExternalLink>
        . You should review the repository license and notices before copying,
        distributing, modifying, or self-hosting the project.
      </>,
      "Copyright in user uploads, third-party assets, brand assets, and third-party trademarks remains with the respective owners. These Terms do not give you any right to use material you do not own or control, except to the extent permitted by a valid license, permission, or applicable law.",
      <>
        If you believe content available through Tokokino infringes your
        copyright or improperly uses your asset, trademark, or other protected
        material, you should open an issue or contact the project through{" "}
        <ExternalLink href="https://github.com/shivabhattacharjee/tokokino">
          github.com/shivabhattacharjee/tokokino
        </ExternalLink>{" "}
        with enough detail for the project maintainers to review and respond.
      </>,
    ],
  },
  {
    title: "7. Third-Party Services",
    body: [
      "The Service may rely on or link to third-party services, including authentication providers, hosting providers, storage services, analytics tools, image sources, and payment or export integrations. Your use of third-party services may be governed by separate terms and privacy policies of those third parties.",
      "Tokokino is not responsible for third-party services, third-party content, or the acts or omissions of third-party providers. Access to those services may change or become unavailable without notice.",
    ],
  },
  {
    title: "8. Privacy and Data Protection",
    body: [
      "Tokokino processes personal information in connection with authentication, account management, Service operation, security, support, and product improvement. Because this is an open-source project with optional hosted components, data practices may differ between the public codebase, self-hosted deployments, and any official hosted instance.",
      "You are responsible for ensuring that any personal information included in User Content has been collected and shared lawfully and with all required notices, permissions, and consents.",
    ],
  },
  {
    title: "9. Paid Features and Changes",
    body: [
      "Certain features may be offered for free, as a beta, or as paid functionality. If paid features are introduced, applicable prices, billing terms, renewal terms, taxes, cancellation rights, and refund rules will be disclosed at or before purchase.",
      "The project may change feature availability, usage limits, storage limits, export limits, or pricing for future use of any hosted Service, subject to applicable law and any terms presented at the time of purchase.",
    ],
  },
  {
    title: "10. Disclaimers",
    body: [
      "The Service is provided on an as is and as available basis. To the maximum extent permitted by applicable law, Tokokino disclaims all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, availability, accuracy, and reliability.",
      "Tokokino does not warrant that the Service will be uninterrupted, secure, error-free, free from harmful components, or that any content will be preserved without loss. You are responsible for maintaining independent backups of important User Content.",
    ],
  },
  {
    title: "11. Limitation of Liability",
    body: [
      "To the maximum extent permitted by applicable law, Tokokino and its maintainers, contributors, licensors, service providers, and agents will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, goodwill, data, content, business opportunity, or business interruption, arising out of or relating to the Service or these Terms.",
      "To the maximum extent permitted by applicable law, Tokokino's aggregate liability for all claims arising out of or relating to the Service or these Terms will not exceed the greater of the amount you paid for the hosted Service in the three months preceding the event giving rise to the claim or one hundred United States dollars (US $100).",
    ],
  },
  {
    title: "12. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless Tokokino and its maintainers, contributors, licensors, service providers, and agents from and against any claims, liabilities, damages, losses, costs, and expenses, including reasonable attorneys' fees, arising out of or relating to your User Content, your use or misuse of the Service, your violation of these Terms, your violation of law, or your violation of any third-party rights.",
    ],
  },
  {
    title: "13. Suspension and Termination",
    body: [
      "Tokokino may suspend or terminate your access to the Service, remove content, or disable features at any time if it reasonably believes that you have violated these Terms, created legal risk, caused harm to the Service or others, or used the Service in a manner inconsistent with its intended purpose.",
      "You may stop using the Service at any time. Provisions that by their nature should survive termination will survive, including provisions concerning ownership, licenses necessary for completed sharing or exports, disclaimers, limitations of liability, indemnification, dispute terms, and general legal terms.",
    ],
  },
  {
    title: "14. Changes to These Terms",
    body: [
      "Tokokino may update these Terms from time to time. Updated Terms will be posted with a revised effective date. Your continued use of the Service after updated Terms become effective constitutes acceptance of the updated Terms, except where applicable law requires a different form of notice or consent.",
    ],
  },
  {
    title: "15. Governing Law and Disputes",
    body: [
      "Unless a separate written agreement states otherwise, these Terms are governed by the laws of India, without regard to conflict-of-law rules. For operational and interpretive purposes, the operator of Tokokino is principally located in Guwahati, Assam, India.",
      "If a dispute, claim, or controversy arises out of or relates to Tokokino or these Terms, you and Tokokino agree to first try to resolve the matter informally and in good faith by contacting the other side with reasonable detail about the issue, the affected account or content if relevant, and the relief requested.",
      "If a dispute cannot be resolved informally within a reasonable time, the parties may pursue remedies available under applicable law before the courts or other competent forums having jurisdiction in Guwahati, Assam, India, unless a different forum is required by mandatory law or a separate written agreement.",
      "Nothing in these Terms limits rights or remedies that cannot be waived under applicable consumer protection, data protection, or other mandatory laws.",
    ],
  },
  {
    title: "16. Contact",
    body: [
      "Questions, notices, issue reports, support requests, account concerns, copyright complaints, asset infringement reports, or requests concerning these Terms should be directed through the contact methods made available in the Service or the public project materials.",
      <>
        You may contact Tokokino through{" "}
        <ExternalLink href="https://github.com/shivabhattacharjee/tokokino">
          github.com/shivabhattacharjee/tokokino
        </ExternalLink>
        , through the project repository when an issues or discussions channel
        is available, by email at{" "}
        <ExternalLink href="mailto:hello@theshiva.xyz">
          hello@theshiva.xyz
        </ExternalLink>
        , or on X at{" "}
        <ExternalLink href="https://x.com/sh17va">x.com/sh17va</ExternalLink> if
        you want to contact the owner or developer directly. Where relevant,
        please include clear details about copyright, asset ownership, or
        infringement concerns.
      </>,
      "For general bugs, feature requests, and non-private support matters, the project repository is usually the best first contact point. For account-specific concerns, private legal notices, or matters that should not be posted publicly, email is the preferred contact method.",
      "If you are reporting copyright or asset infringement, please include enough information for review, such as your name, contact details, a description of the protected work or asset, the specific URL, page, or content at issue, the basis of your claim, and any supporting links or evidence that may help verify ownership or authorization.",
      "Tokokino may respond through any of the contact methods you use, may request additional information where needed, and may remove, restrict, or preserve access to reported content while a review is pending.",
    ],
  },
]

const indexItems = sections.map((section) => ({
  id: slugify(section.title),
  label: section.title.replace(/^\d+\.\s/, ""),
}))

export default function TermsPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="border-b border-border/70 bg-card/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-7 sm:px-10 lg:px-12">
          <nav className="flex items-center justify-between gap-5">
            <BrandLogo />
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to sign in
            </Link>
          </nav>

          <div className="min-w-0 space-y-4 text-left">
            <h1 className="max-w-full text-[clamp(1.75rem,5.2vw,5.05rem)] leading-[0.95] font-semibold tracking-[-0.04em] whitespace-nowrap">
              Terms &amp; Conditions
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              These terms define the rules for accessing, using, saving,
              exporting, and sharing work through Tokokino as an open-source
              project and hosted screenshot tool.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              Effective date:{" "}
              <strong className="font-semibold text-foreground">
                {EFFECTIVE_DATE}
              </strong>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[240px_1fr] lg:px-12 lg:py-14">
        <aside className="hidden lg:block">
          <TermsIndex items={indexItems} />
        </aside>

        <article className="min-w-0 space-y-9">
          <div className="border-l-2 border-primary/60 pl-5 text-sm leading-7 text-muted-foreground">
            <p>
              Please read these Terms carefully. They contain important
              provisions affecting your legal rights, including disclaimers,
              limits of liability, and obligations relating to content that you
              upload or share.
            </p>
          </div>

          {sections.map((section) => (
            <section
              key={section.title}
              id={slugify(section.title)}
              className="scroll-mt-8 border-t border-border/70 pt-8"
            >
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
                {section.body.map((paragraph, index) => (
                  <p key={`${section.title}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </section>
    </main>
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
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/60"
    >
      {children}
    </Link>
  )
}
