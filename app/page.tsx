import { LandingPageClient } from "@/components/landing/landing-page-client"
import {
  serializeJsonLd,
  tokokinoStructuredData,
} from "@/lib/seo/tokokino-structured-data"
import type { Metadata } from "next"

const description =
  "Create polished product screenshots and animated demos with device frames, backgrounds, annotations, timeline editing, and fast image or GIF/WebM exports."

export const metadata: Metadata = {
  description,
}

const NO_SCRIPT_STYLES = `
  [data-landing-page] [style*="opacity"],
  [data-landing-page] [style*="transform"],
  [data-landing-page] [style*="filter"] {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
  }
`

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(tokokinoStructuredData),
        }}
      />
      <noscript>
        <style>{NO_SCRIPT_STYLES}</style>
      </noscript>
      <div data-landing-page className="contents">
        <LandingPageClient />
      </div>
    </>
  )
}
