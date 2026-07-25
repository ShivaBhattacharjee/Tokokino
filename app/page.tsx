import { LandingPageClient } from "@/components/landing/landing-page-client"
import type { Metadata } from "next"

const description =
  "Create polished product screenshots and animated demos with device frames, backgrounds, annotations, timeline editing, and fast image or GIF/WebM exports."

export const metadata: Metadata = {
  description,
}

export default function Page() {
  return <LandingPageClient />
}
