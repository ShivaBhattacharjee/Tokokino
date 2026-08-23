import type { Metadata } from "next"
import Link from "next/link"

import { DocPage } from "@/components/landing/doc-page"

export const metadata: Metadata = {
  title: "About Tokokino",
  description:
    "Learn why Tokokino exists, how its local-first editor works, and how the open-source project is maintained.",
}

const sections = [
  {
    title: "A focused tool for product visuals",
    body: (
      <>
        Tokokino exists to shorten the distance between a raw product capture
        and a visual that is ready for a launch, changelog, help article,
        presentation, or social post. Instead of rebuilding the same frame,
        background, spacing, and annotation treatment in a general design suite,
        you can start with a screenshot or recording and work inside an editor
        built around that material. Device mockups, browser frames, multi-shot
        layouts, reusable presets, and high-resolution exports are part of the
        same workflow.
      </>
    ),
  },
  {
    title: "Local-first by design",
    body: (
      <>
        The interactive editor runs primarily in your browser. Ordinary edits
        and exports do not require an account, and source captures are not
        uploaded merely because you opened them in the canvas. Server-backed
        features are explicit: signing in can enable cloud drafts, and creating
        a public share sends the rendered result needed for that link. This
        boundary keeps quick, private editing simple while still making
        collaboration available when you choose it.
      </>
    ),
  },
  {
    title: "Still images and motion in one editor",
    body: (
      <>
        Tokokino handles polished PNG, JPEG, and WebP compositions as well as
        short animated demos. A timeline can animate canvas effects and
        transitions, while video and GIF inputs can be cropped, trimmed, and
        combined with the same framing and backdrop tools used for stills. The
        goal is not to replace a full illustration or long-form video suite; it
        is to make screenshot-led product communication faster and more
        consistent.
      </>
    ),
  },
  {
    title: "An independent open-source project",
    body: (
      <>
        Tokokino is an independent personal project maintained by Shiva
        Bhattacharjee from Guwahati, Assam, India. It is not presented as a
        registered company. The source is published under the AGPL-3.0 license,
        so people can inspect how the product works, report problems, propose
        improvements, and self-host it subject to the license. Product updates
        are documented in the changelog, and public development happens through
        the project repository.
      </>
    ),
  },
]

export default function AboutPage() {
  return (
    <DocPage
      eyebrow="About"
      title="A smaller, sharper way to present product work."
      summary="Tokokino is an open-source, local-first editor for polished screenshots, mockups, social visuals, and short animated product demos."
    >
      <article className="max-w-3xl">
        <div className="grid gap-px overflow-hidden rounded-md border border-border/60 bg-border/60 sm:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="bg-background/80 p-6 sm:p-7"
            >
              <h2 className="text-base font-medium tracking-tight sm:text-lg">
                {section.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-foreground/58">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-border/50 pt-8 text-sm leading-7 text-foreground/58">
          Ready to make something? Open the{" "}
          <Link
            href="/app"
            className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
          >
            editor
          </Link>
          , browse the{" "}
          <Link
            href="/showcase"
            className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
          >
            template showcase
          </Link>
          , or visit the{" "}
          <Link
            href="/contact"
            className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
          >
            contact page
          </Link>{" "}
          if you need help or want to contribute.
        </div>
      </article>
    </DocPage>
  )
}
