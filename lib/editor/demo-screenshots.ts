/**
 * Pre-captured full-page demo screenshots hosted on R2.
 * Captured the same way as /api/screenshot (fullPage: true, delay 2s).
 * When loaded into the canvas they use setFullPageScreenshot so scroll/crop
 * behavior matches live captures.
 */

export type DemoScreenshot = {
  id: string
  name: string
  url: string
}

export const DEMO_SCREENSHOTS: readonly DemoScreenshot[] = [
  {
    id: "framer",
    name: "Framer",
    url: "https://assets.tokokino.com/demos/framer.png",
  },
  {
    id: "motion",
    name: "Motion",
    url: "https://assets.tokokino.com/demos/motion.png",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    url: "https://assets.tokokino.com/demos/cloudflare.png",
  },
  {
    id: "stripe",
    name: "Stripe",
    url: "https://assets.tokokino.com/demos/stripe.png",
  },
  {
    id: "figma",
    name: "Figma",
    url: "https://assets.tokokino.com/demos/figma.png",
  },
  {
    id: "supabase",
    name: "Supabase",
    url: "https://assets.tokokino.com/demos/supabase.png",
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    url: "https://assets.tokokino.com/demos/tailwind.png",
  },
  {
    id: "webflow",
    name: "Webflow",
    url: "https://assets.tokokino.com/demos/webflow.png",
  },
  {
    id: "cal",
    name: "Cal.com",
    url: "https://assets.tokokino.com/demos/cal.png",
  },
  {
    id: "dub",
    name: "Dub",
    url: "https://assets.tokokino.com/demos/dub.png",
  },
  {
    id: "loom",
    name: "Loom",
    url: "https://assets.tokokino.com/demos/loom.png",
  },
  {
    id: "cursor",
    name: "Cursor",
    url: "https://assets.tokokino.com/demos/cursor.png",
  },
  {
    id: "apple",
    name: "Apple",
    url: "https://assets.tokokino.com/demos/apple.png",
  },
] as const

/** Pick a random demo screenshot URL (uniform). */
export function pickRandomDemoScreenshot(): DemoScreenshot {
  const list = DEMO_SCREENSHOTS
  if (list.length === 0) {
    throw new Error("No demo screenshots configured")
  }
  const index = Math.floor(Math.random() * list.length)
  return list[index]
}
