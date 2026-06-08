"use client"

import { motion } from "motion/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ease } from "@/components/landing/constants"

const faqs = [
  {
    q: "Do I need an account to use Tokokino?",
    a: "No account needed to edit and export. You can drop in a screenshot, style it, and download a PNG/JPEG/WebP right away — no sign-in required. An account (email or Google) is only needed if you want to create public share links or access your share history.",
  },
  {
    q: "Is Tokokino free? Are any features paid?",
    a: "The editor and all export options are free. Certain features — such as higher storage limits, additional export quotas, or advanced sharing options — may become paid in the future. Any paid features will be clearly disclosed with pricing before you're charged. Nothing currently requires payment.",
  },
  {
    q: "Is Tokokino open source?",
    a: "Yes. The source code is released under the AGPL-3.0 license. You can inspect, self-host, or contribute via the GitHub repository at git.new/Tokokino.",
  },
  {
    q: "What export formats and resolutions are supported?",
    a: "You can export as PNG, JPEG, or WebP at HD (1920 px), 4K (3840 px), or 8K (7680 px) width. You can also copy directly to your clipboard as a PNG at 1080 px.",
  },
  {
    q: "Are my screenshots sent to any server?",
    a: "No. All editing happens locally in your browser — your images never leave your device unless you explicitly click Share. When you share, the final rendered image (not your original screenshot) is uploaded to cloud storage and a unique link is generated.",
  },
  {
    q: "Are my screenshots used for AI training?",
    a: "No. Tokokino does not use your screenshots, shared images, or editor activity to train AI models. Shared images are stored only so your public link can work, and your original screenshots stay in your browser unless you choose to share a rendered export.",
  },
  {
    q: "What happens to my shared images?",
    a: "Shared images are stored in the cloud and accessible to anyone with the link. You can view all your shares in the Gallery page. You retain ownership of your content; Tokokino only holds a limited license to host and serve it as described in the Terms.",
  },
  {
    q: "Can I add multiple screenshots to one canvas?",
    a: "Yes. Each canvas supports up to 3 extra screenshot slots. You can arrange them with built-in layout presets — Side by Side, Depth Duo, Fan Out, Scatter, Perspective, and more — or position them freely.",
  },
  {
    q: "Can I turn an X (Twitter) or Bluesky post into an image?",
    a: "Yes. Paste a post link and Tokokino fetches the post and renders a clean mockup — author, avatar, text, images, and stats — that you can style and export like any screenshot. Pick a Light, Dim, or Dark theme, choose a font, and toggle the avatar, images, stats, date, and the quoted (parent) post on or off. Single images fill the card edge to edge and quoted posts render inline.",
  },
  {
    q: "What device frames are available?",
    a: "Tokokino includes pixel-accurate mockup frames for iPhone, Pixel phones, MacBook, and browser chrome (Safari, Chrome, Arc). Frames are applied non-destructively and are stripped from exports automatically if needed.",
  },
  {
    q: "What browsers and devices does Tokokino support?",
    a: "Tokokino runs in any modern browser — no installation required. It works best in Chromium-based browsers (Chrome, Edge, Arc) and Safari on macOS. Firefox is supported but some CSS blend modes and backdrop filters may render slightly differently. On mobile, the editor loads but is optimized for desktop use; exporting and sharing work on all devices.",
  },
  {
    q: "Do you sell or share my personal data?",
    a: "No. Tokokino does not sell your personal data to third parties. The only data processed is what's needed to run the service: account info for authentication (via Google or email), and the rendered image you explicitly choose to share. Your original screenshots never leave your browser. See the Terms for the full data practices disclosure.",
  },
]

function FaqColumn({
  items,
  offset = 0,
}: {
  items: typeof faqs
  offset?: number
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="overflow-hidden rounded-xl border border-border/60"
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: (offset + i) * 0.04, ease }}
        >
          <AccordionItem
            value={`item-${offset + i}`}
            className="border-b border-border/60 bg-background/70 px-7 last:border-b-0 data-[state=open]:bg-background"
          >
            <AccordionTrigger className="py-5 text-left text-[15px] font-medium tracking-tight text-foreground/85 hover:text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-[13px] leading-relaxed text-foreground/55">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        </motion.div>
      ))}
    </Accordion>
  )
}

export function Faq() {
  return (
    <section id="faq" className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
      {/* Desktop: title left, accordion right. Mobile: stacked */}
      <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-16">
        {/* Left — sticky title */}
        <div className="flex-shrink-0 md:w-64 md:pt-1">
          <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
            {"// FAQ"}
          </span>
          <h2 className="mt-2 text-2xl tracking-tight whitespace-nowrap">
            Common questions
          </h2>
        </div>

        {/* Right — full accordion */}
        <div className="flex-1">
          <FaqColumn items={faqs} offset={0} />
        </div>
      </div>
    </section>
  )
}
