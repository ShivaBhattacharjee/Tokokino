import type { Metadata } from "next"
import Link from "next/link"

import { DocIndex } from "@/components/landing/doc-index"
import { DocPage } from "@/components/landing/doc-page"

export const metadata: Metadata = {
  title:
    "Tokokino Developer Portal — API docs, OpenAPI spec, and agent resources",
  description:
    "Developer documentation for the Tokokino API: OpenAPI specification, session authentication, share and draft endpoints, JSON error codes, and the Tokokino agent resources.",
  alternates: { canonical: "/developers" },
}

const INDEX = [
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "openapi", label: "OpenAPI specification" },
  { id: "endpoints", label: "Endpoints" },
  { id: "errors", label: "Error format" },
  { id: "limits", label: "Limits and quotas" },
  { id: "agents", label: "Agent and MCP resources" },
  { id: "support", label: "Support" },
]

const ENDPOINTS = [
  {
    group: "Shares",
    rows: [
      ["POST", "/api/share", "Create a share link from image bytes"],
      ["GET", "/api/share", "List your shares and storage usage"],
      ["DELETE", "/api/share/{id}", "Delete one share"],
      [
        "POST",
        "/api/share/uploads",
        "Open a multipart upload for a video share",
      ],
      ["POST", "/api/share/uploads/{id}/complete", "Finalise a video share"],
    ],
  },
  {
    group: "Drafts",
    rows: [
      ["GET", "/api/drafts", "List saved drafts"],
      ["POST", "/api/drafts", "Save a new draft"],
      ["GET", "/api/drafts/{id}", "Fetch a draft with its full editor state"],
      ["PATCH", "/api/drafts/{id}", "Rename a draft"],
      ["DELETE", "/api/drafts/{id}", "Delete a draft"],
    ],
  },
  {
    group: "Presets and preferences",
    rows: [
      ["GET", "/api/presets", "List custom style presets"],
      ["POST", "/api/presets", "Create a custom style preset"],
      ["GET", "/api/preferences", "Read editor preferences"],
      ["PUT", "/api/preferences", "Update editor preferences"],
    ],
  },
  {
    group: "Media",
    rows: [
      ["POST", "/api/screenshot", "Capture a screenshot of a public URL"],
      ["GET", "/api/tweet", "Fetch an X or Bluesky post for a mockup"],
      ["GET", "/api/unsplash/search", "Search Unsplash backgrounds"],
      ["GET", "/api/export/image", "CORS proxy for external images"],
    ],
  },
]

const ERROR_CODES = [
  ["unauthorized", "401", "No valid session cookie was sent."],
  ["forbidden", "403", "The account may not perform this action."],
  ["not_found", "404", "No such path, or the resource is not yours."],
  ["invalid_request", "400", "Body or query parameters failed validation."],
  ["unsupported_media_type", "415", "The Content-Type is not accepted here."],
  ["payload_too_large", "413", "The upload exceeds a size cap or quota."],
  ["rate_limited", "429", "Too many requests in the current window."],
  ["internal_error", "500", "Something failed server-side. Retry shortly."],
]

const RESOURCES = [
  {
    href: "/openapi.json",
    label: "OpenAPI 3.1 specification",
    note: "Every documented endpoint, schema, and error response.",
  },
  {
    href: "/auth.md",
    label: "Authentication guide",
    note: "How to obtain and send a Tokokino session cookie.",
  },
  {
    href: "/llms.txt",
    label: "llms.txt",
    note: "Product summary and machine-readable resource index for AI agents.",
  },
  {
    href: "/.well-known/ai-catalog.json",
    label: "ARD capability manifest",
    note: "Agentic Resource Discovery catalogue of everything listed here.",
  },
  {
    href: "/.well-known/mcp/server-card.json",
    label: "MCP server card",
    note: "Model Context Protocol descriptor. The server is not live yet — /mcp answers 503 with a coming-soon payload until it ships.",
  },
  {
    href: "/.well-known/agent-skills/index.json",
    label: "Agent skills index",
    note: "Skill documents for the share, drafts, and presets workflows.",
  },
  {
    href: "/.well-known/api-catalog",
    label: "API catalog",
    note: "RFC 9727 linkset of published machine interfaces.",
  },
]

const CURL = `curl -X POST https://tokokino.com/api/share \\
  -H "Content-Type: image/png" \\
  -H "Cookie: better-auth.session_token=<your-session-token>" \\
  --data-binary @screenshot.png`

const ERROR_SAMPLE = `{
  "error": "Sign in required",
  "code": "unauthorized",
  "message": "Sign in required",
  "hint": "Sign in at https://tokokino.com/login and send the session cookie with the request. See https://tokokino.com/auth.md.",
  "docs": "https://tokokino.com/developers#errors"
}`

const linkClass =
  "font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/50 pt-8">
      <h2 className="text-base font-medium tracking-tight sm:text-lg">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-7 text-foreground/58">
        {children}
      </div>
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-md border border-border/60 bg-background/80 p-4 font-mono text-[12px] leading-6 text-foreground/75">
      <code>{children}</code>
    </pre>
  )
}

export default function DevelopersPage() {
  return (
    <DocPage
      eyebrow="Developers"
      title="Tokokino developer portal"
      summary="Build against the Tokokino API. Everything below is served at a stable URL: an OpenAPI 3.1 specification, session authentication, structured JSON errors, and the agent-facing manifests that describe this site to automated clients."
      index={<DocIndex items={INDEX} />}
    >
      <article className="flex max-w-3xl flex-col gap-8">
        <Section id="quickstart" title="Quickstart">
          <p>
            Tokokino edits and exports entirely in the browser, so most of the
            product needs no API at all. The API covers the server-backed
            features: public share links, cloud drafts, custom presets,
            preferences, and a few media proxies.
          </p>
          <p className="mt-4">
            Create a share by POSTing raw image bytes with a session cookie:
          </p>
          <Code>{CURL}</Code>
          <p className="mt-4">
            The response carries the public share URL, the stored image URL, and
            your remaining storage quota. The full request and response schemas
            live in the{" "}
            <Link href="/openapi.json" className={linkClass}>
              OpenAPI specification
            </Link>
            .
          </p>
        </Section>

        <Section id="authentication" title="Authentication">
          <p>
            Tokokino uses{" "}
            <span className="font-mono text-[12px]">better-auth</span> session
            cookies — email and password, or Google OAuth. There are no API
            keys. Sign in at{" "}
            <Link href="/login" className={linkClass}>
              /login
            </Link>{" "}
            and send the resulting{" "}
            <span className="font-mono text-[12px]">
              better-auth.session_token
            </span>{" "}
            cookie with each request.
          </p>
          <p className="mt-4">
            The{" "}
            <Link href="/auth.md" className={linkClass}>
              authentication guide
            </Link>{" "}
            is published as Markdown for agent and MCP clients.
          </p>
        </Section>

        <Section id="openapi" title="OpenAPI specification">
          <p>
            The machine-readable contract is published at{" "}
            <Link href="/openapi.json" className={linkClass}>
              /openapi.json
            </Link>{" "}
            (also served at{" "}
            <Link href="/api/openapi.json" className={linkClass}>
              /api/openapi.json
            </Link>
            ). It is OpenAPI 3.1, sent as{" "}
            <span className="font-mono text-[12px]">application/json</span> with{" "}
            <span className="font-mono text-[12px]">
              Access-Control-Allow-Origin: *
            </span>
            , so it can be loaded directly by generators and agents.
          </p>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <p>
            The most-used endpoints are listed here. The specification is the
            complete reference.
          </p>
          <div className="mt-5 flex flex-col gap-6">
            {ENDPOINTS.map((group) => (
              <div key={group.group}>
                <h3 className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
                  {group.group}
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border/50 text-foreground/45">
                        <th className="py-2 pr-4 font-normal">Method</th>
                        <th className="py-2 pr-4 font-normal">Path</th>
                        <th className="py-2 font-normal">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(([method, path, purpose]) => (
                        <tr
                          key={`${method} ${path}`}
                          className="border-b border-border/30"
                        >
                          <td className="py-2 pr-4 font-mono text-[11px] text-primary/80">
                            {method}
                          </td>
                          <td className="py-2 pr-4 font-mono text-[11px] whitespace-nowrap text-foreground/75">
                            {path}
                          </td>
                          <td className="py-2 text-foreground/58">{purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="errors" title="Error format">
          <p>
            Every API error is JSON — including unmatched{" "}
            <span className="font-mono text-[12px]">/api/*</span> paths, which
            answer with a JSON 404 rather than an HTML error page. Errors carry
            a stable machine-readable{" "}
            <span className="font-mono text-[12px]">code</span>, a human{" "}
            <span className="font-mono text-[12px]">message</span>, and a{" "}
            <span className="font-mono text-[12px]">hint</span> describing how
            to resolve it.
          </p>
          <Code>{ERROR_SAMPLE}</Code>
          <p className="mt-4">
            The <span className="font-mono text-[12px]">error</span> field
            repeats <span className="font-mono text-[12px]">message</span> so
            that existing clients reading a plain string keep working.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/50 text-foreground/45">
                  <th className="py-2 pr-4 font-normal">Code</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 font-normal">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ERROR_CODES.map(([code, status, meaning]) => (
                  <tr key={code} className="border-b border-border/30">
                    <td className="py-2 pr-4 font-mono text-[11px] text-primary/80">
                      {code}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-foreground/75">
                      {status}
                    </td>
                    <td className="py-2 text-foreground/58">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="limits" title="Limits and quotas">
          <p>
            A single share image may be up to 40 MB; video shares upload in 8 MB
            parts up to 1 GB. Each account has 1 GB of total share storage.
            Draft bodies are capped at 15 MB and presets at 1 MB. Write and
            capture endpoints are rate limited per account or IP, and answer
            with <span className="font-mono text-[12px]">rate_limited</span>{" "}
            when a window is exhausted.
          </p>
        </Section>

        <Section id="agents" title="Agent and MCP resources">
          <p>
            Tokokino publishes its capabilities for automated clients at
            predictable, well-known URLs.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {RESOURCES.map((resource) => (
              <li key={resource.href}>
                <Link href={resource.href} className={linkClass}>
                  {resource.label}
                </Link>
                <span className="text-foreground/45"> — {resource.note}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="support" title="Support">
          <p>
            Tokokino is open source under AGPL-3.0. Report a bug, request an
            endpoint, or ask a question on{" "}
            <a
              href="https://git.new/Tokokino"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              GitHub
            </a>{" "}
            or through the{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>
            .
          </p>
        </Section>
      </article>
    </DocPage>
  )
}
