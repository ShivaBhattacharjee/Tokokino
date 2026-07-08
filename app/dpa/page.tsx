import type { Metadata } from "next"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import { DpaIndex } from "./dpa-index"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata: Metadata = {
  title: "Data Processing Addendum — Tokokino",
  description:
    "Review Tokokino's data processing terms for hosted account, sharing, and support features.",
}

const LAST_UPDATED = "March 2026"

type DpaSection = {
  title: string
  body: ReactNode[]
}

type SubProcessorGroup = {
  title: string
  rows: {
    name: string
    purpose: string
    entity: string
    location: string
  }[]
}

const subProcessorGroups: SubProcessorGroup[] = [
  {
    title: "Cloud Infrastructure & Hosting",
    rows: [
      {
        name: "Cloudflare",
        purpose:
          "Application hosting, request routing, D1 database, R2 object storage, CDN delivery, security controls, logs, and optional browser rendering infrastructure.",
        entity: "Cloudflare, Inc.",
        location: "United States / Global",
      },
    ],
  },
  {
    title: "Authentication & Account Access",
    rows: [
      {
        name: "Google OAuth",
        purpose:
          "Optional sign-in provider when a user chooses Google authentication.",
        entity: "Google LLC",
        location: "United States / Global",
      },
    ],
  },
  {
    title: "Customer-Enabled Content Sources",
    rows: [
      {
        name: "Unsplash",
        purpose:
          "Optional image search and download flow when a user chooses Unsplash backgrounds or image assets.",
        entity: "Unsplash Inc.",
        location: "United States",
      },
      {
        name: "GitHub",
        purpose:
          "Public repository hosting, issue discussion, security reports, and support communications submitted through the project repository.",
        entity: "GitHub, Inc.",
        location: "United States",
      },
    ],
  },
]

const sections: DpaSection[] = [
  {
    title: "1. Definitions",
    body: [
      <p key="definitions-intro">
        For purposes of this Data Processing Addendum, the following terms
        apply. Capitalized terms not defined here have the meanings given in the
        Tokokino Terms of Service or other written agreement that incorporates
        this Addendum.
      </p>,
      <DefinitionList
        key="definitions"
        items={[
          {
            term: "Affiliate",
            description:
              "Any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where control means ownership of more than 50% of the voting interests or equivalent authority.",
          },
          {
            term: "Customer Personal Data",
            description:
              "Personal Data that Customer provides to Tokokino, or that Tokokino processes on Customer's behalf, through hosted account, sharing, draft, support, or related service features.",
          },
          {
            term: "Data Protection Laws",
            description:
              "Applicable privacy and data protection laws, including the GDPR, UK GDPR, CCPA/CPRA, the Swiss Federal Act on Data Protection, and similar laws that apply to the processing.",
          },
          {
            term: "EU Area",
            description:
              "The European Union, European Economic Area, United Kingdom, and Switzerland.",
          },
          {
            term: "Personal Data",
            description:
              "Information relating to an identified or identifiable natural person, as defined by applicable Data Protection Laws.",
          },
          {
            term: "Processing",
            description:
              "Any operation performed on Personal Data, including collection, recording, storage, retrieval, use, disclosure, deletion, or destruction.",
          },
          {
            term: "Security Incident",
            description:
              "A confirmed unauthorized or unlawful disclosure of, access to, loss of, or destruction of Customer Personal Data.",
          },
          {
            term: "Sub-processor",
            description:
              "A third party engaged by Tokokino to process Customer Personal Data on behalf of Customer.",
          },
          {
            term: "Standard Contractual Clauses or SCCs",
            description:
              "The contractual clauses adopted by the European Commission for transfers of Personal Data to third countries, as amended or replaced from time to time.",
          },
        ]}
      />,
    ],
  },
  {
    title: "2. Scope",
    body: [
      <p key="scope-1">
        This Addendum applies to Tokokino&apos;s Processing of Customer Personal
        Data in connection with the hosted Tokokino services, including account
        authentication, public sharing, saved drafts, support communications,
        and related operational systems, to the extent such Processing is
        subject to Data Protection Laws.
      </p>,
      <p key="scope-2">
        Tokokino&apos;s editor is local-first by default. Screenshots and
        styling work remain in the user&apos;s browser unless the user chooses
        to sign in, save, upload, share, or otherwise use a server-backed
        feature.
      </p>,
      <p key="scope-3">
        Except as modified by this Addendum, the Agreement remains in effect. If
        this Addendum conflicts with the Agreement on data protection matters,
        this Addendum controls for those matters.
      </p>,
    ],
  },
  {
    title: "3. Party Roles",
    body: [
      <p key="roles-1">
        Customer acts as the Controller, or Business where applicable under the
        CCPA/CPRA, for Customer Personal Data.
      </p>,
      <p key="roles-2">
        Tokokino acts as the Processor, or Service Provider where applicable
        under the CCPA/CPRA, when it processes Customer Personal Data on
        Customer&apos;s behalf to provide hosted service features.
      </p>,
      <p key="roles-3">
        Customer is responsible for providing required notices, obtaining
        required consents, and ensuring that Customer Personal Data, including
        Personal Data contained in screenshots, uploads, filenames, text layers,
        or shared images, may lawfully be processed through the Services.
      </p>,
    ],
  },
  {
    title: "4. Data Processing Obligations",
    body: [
      <p key="obligations-intro">
        With respect to Customer Personal Data, Tokokino will:
      </p>,
      <LegalList
        key="obligations-list"
        items={[
          "Process Customer Personal Data only on Customer's documented instructions, including as necessary to provide, secure, maintain, support, and improve the Services, unless applicable law requires otherwise.",
          "Ensure that people authorized to process Customer Personal Data are subject to appropriate confidentiality obligations.",
          "Implement and maintain reasonable technical and organizational security measures designed to protect Customer Personal Data against unauthorized Processing and accidental loss, destruction, or damage.",
          "Engage Sub-processors only as described in this Addendum and remain responsible for their performance to the extent required by Data Protection Laws.",
          "Promptly notify Customer of any legally binding request for disclosure of Customer Personal Data by a public authority unless legally prohibited from doing so.",
          "Notify Customer without undue delay after becoming aware of a Security Incident involving Customer Personal Data.",
          "Provide reasonable assistance with data subject rights requests to the extent Tokokino can do so based on the hosted Services and Customer's use of them.",
          "Upon termination or expiry of the Agreement, delete or return Customer Personal Data in Tokokino's possession upon Customer's reasonable request, unless retention is required by law or needed for legitimate security, dispute, or backup lifecycle purposes.",
          "Make available information reasonably necessary to demonstrate compliance with this Addendum, subject to confidentiality, security, and reasonable scope limitations.",
        ]}
      />,
    ],
  },
  {
    title: "5. International Data Transfers",
    body: [
      <p key="transfers-1">
        Tokokino and its Sub-processors may process Customer Personal Data in
        the United States, India, and other countries where infrastructure or
        service providers operate. Where Customer Personal Data from the EU Area
        is transferred to a country that has not been deemed adequate, the
        parties agree to use appropriate safeguards required by Data Protection
        Laws.
      </p>,
      <LegalList
        key="transfers-list"
        items={[
          "GDPR Transfers: the European Commission's Standard Contractual Clauses, Module Two for controller-to-processor transfers, are incorporated by reference where applicable.",
          "UK Transfers: the UK International Data Transfer Addendum to the EU SCCs applies where required for Personal Data subject to the UK GDPR.",
          "Swiss Transfers: the SCCs apply with modifications required by the Swiss Federal Act on Data Protection, including references to the competent Swiss supervisory authority where needed.",
          "AI/ML Processing: Tokokino is a screenshot editing and sharing tool. As of the Last Updated date, Tokokino does not use Customer Personal Data to train external AI or machine learning models.",
        ]}
      />,
    ],
  },
  {
    title: "6. Security Measures",
    body: [
      <p key="security-intro">
        Tokokino maintains reasonable technical and organizational measures
        appropriate for the nature of the hosted Services and the open-source
        project. These measures include:
      </p>,
      <h3
        key="security-management"
        className="text-base font-semibold text-foreground"
      >
        6.1 Information Security Management
      </h3>,
      <LegalList
        key="security-management-list"
        items={[
          "Security-conscious project maintenance, dependency review, and issue response processes.",
          "Use of managed infrastructure providers for hosting, database, object storage, CDN delivery, and platform security controls.",
          "Periodic review of security-sensitive code paths, including authentication, sharing, storage, and export proxy behavior.",
        ]}
      />,
      <h3
        key="security-personnel"
        className="text-base font-semibold text-foreground"
      >
        6.2 Personnel Security
      </h3>,
      <LegalList
        key="security-personnel-list"
        items={[
          "Access to production data and service administration is limited to people with a legitimate operational need.",
          "Private support, account, or legal requests are handled through restricted communication channels when possible.",
        ]}
      />,
      <h3
        key="security-access"
        className="text-base font-semibold text-foreground"
      >
        6.3 Access Controls
      </h3>,
      <LegalList
        key="security-access-list"
        items={[
          "Authentication is required for account-backed features such as share history, drafts, and other user-specific hosted features.",
          "Administrative access is restricted and protected by provider-level authentication controls.",
          "Tokokino follows the principle of least privilege for infrastructure and data access where supported by service providers.",
        ]}
      />,
      <h3
        key="security-infra"
        className="text-base font-semibold text-foreground"
      >
        6.4 Infrastructure & Network Security
      </h3>,
      <LegalList
        key="security-infra-list"
        items={[
          "Hosted traffic is served over HTTPS/TLS through managed edge infrastructure.",
          "Share images and draft data are stored in Cloudflare R2, while share, draft, preset, and account metadata are stored in Cloudflare D1.",
          "Public share links are accessible to anyone with the URL; users should avoid sharing content that they do not want made public.",
          "Server routes validate request types and size limits for upload and sharing workflows.",
          "External image export requests are proxied through a controlled API route to support browser rendering while reducing direct client-side CORS exposure.",
        ]}
      />,
    ],
  },
  {
    title: "7. Sub-processors",
    body: [
      <p key="subprocessors-1">
        Customer gives Tokokino general authorization to use Sub-processors for
        the purposes described in this Addendum. Tokokino will impose data
        protection obligations on Sub-processors where required by applicable
        Data Protection Laws and remains responsible for Sub-processor
        performance to the extent required by law.
      </p>,
      <p key="subprocessors-2">
        Tokokino will provide notice of material new Sub-processors by updating
        this page or another reasonably accessible notice. If Customer objects
        on reasonable data protection grounds, Customer may stop using the
        affected hosted Services or contact Tokokino to discuss the concern.
      </p>,
    ],
  },
  {
    title: "8. Security Incident Notification",
    body: [
      <p key="incident-1">
        Tokokino will notify Customer without undue delay after becoming aware
        of a Security Incident involving Customer Personal Data, and where
        feasible within 72 hours. Notice may be provided by email, in-product
        notice, repository notice, or another reasonable communication channel
        depending on the nature of the incident and available contact
        information.
      </p>,
      <p key="incident-2">
        The notice will include available information about the nature of the
        Security Incident, affected data categories, likely consequences,
        mitigation steps, and a point of contact for follow-up. Tokokino will
        take reasonable steps to investigate, mitigate, and remediate confirmed
        Security Incidents.
      </p>,
    ],
  },
  {
    title: "9. Data Subject Rights",
    body: [
      <p key="rights-1">
        Tokokino will provide reasonable assistance to Customer in responding to
        data subject rights requests, including access, correction, deletion,
        restriction, portability, objection, and withdrawal requests, to the
        extent such requests relate to Customer Personal Data processed through
        hosted Services.
      </p>,
      <p key="rights-2">
        Privacy requests may be sent to{" "}
        <ExternalLink href="mailto:hello@theshiva.xyz">
          hello@theshiva.xyz
        </ExternalLink>
        . Requests should include enough detail to identify the relevant
        account, public share URL, draft, or support communication.
      </p>,
    ],
  },
  {
    title: "10. Indemnification",
    body: [
      <p key="indemnification-1">
        Customer will indemnify and hold harmless Tokokino, its maintainer,
        contributors, service providers, and agents from third-party claims,
        damages, losses, costs, and expenses arising from Customer&apos;s breach
        of this Addendum, unlawful Customer instructions, or Customer&apos;s
        failure to comply with applicable Data Protection Laws.
      </p>,
    ],
  },
  {
    title: "11. Compliance Standards",
    body: [
      <p key="compliance-1">
        Tokokino will comply with Data Protection Laws that apply to its
        Processing of Customer Personal Data. Tokokino does not currently claim
        certification under ISO 27001, SOC 2, HIPAA, PCI DSS, or similar
        compliance frameworks unless a separate written notice expressly says
        so.
      </p>,
    ],
  },
  {
    title: "12. Term and Termination",
    body: [
      <p key="term-1">
        This Addendum remains in effect for the duration of the Agreement and
        terminates automatically when the Agreement terminates or expires.
        Provisions that by their nature should survive termination, including
        confidentiality, security, deletion, indemnification, and liability
        provisions, will survive.
      </p>,
    ],
  },
  {
    title: "Annex 1: Details of Processing",
    body: [
      <DefinitionList
        key="annex-1"
        items={[
          {
            term: "Data Exporter (Controller)",
            description:
              "Customer, as defined in the Agreement, including users or organizations that choose to use hosted Tokokino features.",
          },
          {
            term: "Data Importer (Processor)",
            description:
              "Tokokino, the open-source screenshot beautifier project and any official hosted service operated for Tokokino.",
          },
          {
            term: "Categories of Data Subjects",
            description:
              "Customer's users, team members, end users, and other people whose Personal Data appears in account data, support requests, screenshots, uploads, drafts, shared images, or related metadata.",
          },
          {
            term: "Categories of Personal Data",
            description:
              "Names, email addresses, authentication identifiers, avatars where supplied by an identity provider, share and draft metadata, rendered shared images, screenshots or text uploaded by Customer, support messages, operational logs, and technical diagnostics.",
          },
          {
            term: "Purpose of Processing",
            description:
              "Providing authentication, editor-related hosted features, public sharing, draft storage, export support, abuse prevention, security, debugging, support, and service improvement.",
          },
          {
            term: "Duration of Processing",
            description:
              "For the duration of the Agreement, unless deleted earlier by Customer, removed through normal lifecycle management, or retained where required by law or legitimate security, backup, or dispute needs.",
          },
          {
            term: "CCPA Business Purposes",
            description:
              "Performing services on behalf of Customer, maintaining account and share functionality, detecting security incidents, debugging, protecting against fraud and abuse, improving service quality, and preserving service integrity.",
          },
        ]}
      />,
    ],
  },
  {
    title: "Annex 2: Sub-processors",
    body: [
      <p key="annex-2-intro">
        The following Sub-processors are authorized to process Customer Personal
        Data for Tokokino hosted Services. Customer-enabled providers are used
        only when a user chooses the relevant feature or support channel.
      </p>,
      <SubProcessorTables key="annex-2-tables" groups={subProcessorGroups} />,
    ],
  },
  {
    title: "Contact",
    body: [
      <p key="contact-1">
        For questions about this Data Processing Addendum, contact Tokokino at{" "}
        <ExternalLink href="mailto:hello@theshiva.xyz">
          hello@theshiva.xyz
        </ExternalLink>
        .
      </p>,
    ],
  },
]

const indexItems = sections.map((section) => ({
  id: slugify(section.title),
  label: section.title.replace(/^\d+\.\s/, ""),
}))

export default function DpaPage() {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
      }
    >
      <div className={CONTENT_WIDTH}>
        <Nav />
      </div>

      <section className="border-b border-border/70 bg-card/30">
        <div
          className={`flex w-full flex-col gap-10 px-5 py-7 sm:px-8 lg:px-12 ${CONTENT_WIDTH}`}
        >
          <Breadcrumb>
            <BreadcrumbList className="label-eyebrow gap-1.5 text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-foreground">
                  <Link href="/">Back to home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground">
                  Data Processing Addendum
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="min-w-0 space-y-4 text-left">
            <h1 className="max-w-5xl text-[clamp(1.75rem,5.2vw,5.05rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-balance">
              Data Processing Addendum
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              This addendum explains how Tokokino processes Customer Personal
              Data for hosted account, sharing, draft, support, and operational
              features.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              Last updated:{" "}
              <strong className="font-semibold text-foreground">
                {LAST_UPDATED}
              </strong>
            </p>
          </div>
        </div>
      </section>

      <section
        className={`grid w-full gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[240px_1fr] lg:px-12 lg:py-14 ${CONTENT_WIDTH}`}
      >
        <aside className="hidden lg:block">
          <DpaIndex items={indexItems} />
        </aside>

        <article className="min-w-0 space-y-9">
          <div className="border-l-2 border-primary/60 pl-5 text-sm leading-7 text-muted-foreground">
            <p>
              This Addendum forms part of the Tokokino Terms of Service or other
              written or electronic agreement between Tokokino and Customer for
              use of the Services. It applies only to hosted features that
              process Customer Personal Data.
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
                {section.body.map((block, index) => (
                  <div key={`${section.title}-${index}`}>{block}</div>
                ))}
              </div>
            </section>
          ))}
        </article>
      </section>

      <div className={CONTENT_WIDTH}>
        <Footer showRail={false} />
      </div>
      <ScrollToTop />
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

function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

function DefinitionList({
  items,
}: {
  items: { term: string; description: ReactNode }[]
}) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="font-semibold text-foreground">{item.term}</dt>
          <dd className="mt-1">{item.description}</dd>
        </div>
      ))}
    </dl>
  )
}

function SubProcessorTables({ groups }: { groups: SubProcessorGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {group.title}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-[720px] border-collapse text-left text-xs leading-6">
              <thead className="bg-card/60 text-foreground">
                <tr>
                  <th className="border-b border-border/70 px-4 py-3 font-semibold">
                    Sub-processor
                  </th>
                  <th className="border-b border-border/70 px-4 py-3 font-semibold">
                    Purpose
                  </th>
                  <th className="border-b border-border/70 px-4 py-3 font-semibold">
                    Entity
                  </th>
                  <th className="border-b border-border/70 px-4 py-3 font-semibold">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-4 py-3 align-top font-medium text-foreground">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 align-top">{row.purpose}</td>
                    <td className="px-4 py-3 align-top">{row.entity}</td>
                    <td className="px-4 py-3 align-top">{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
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
