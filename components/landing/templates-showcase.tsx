import Link from "next/link"
import { motion } from "motion/react"
import { RiImageLine, RiPlayCircleFill, RiVideoLine } from "@remixicon/react"
import { ArrowRight } from "@/components/landing/landing-svgs"
import { ease } from "@/components/landing/constants"
import {
  TEMPLATE_CATALOG,
  templateEditorHref,
  type TemplateMeta,
} from "@/lib/editor/templates/catalog"
import { Marquee } from "@/components/ui/marquee"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"

const ROW_ONE = TEMPLATE_CATALOG.filter((_, i) => i % 2 === 0)
const ROW_TWO = TEMPLATE_CATALOG.filter((_, i) => i % 2 === 1)

function TemplateCard({ template }: { template: TemplateMeta }) {
  const animated = template.category === "animation"
  return (
    <Link
      href={templateEditorHref(template.id)}
      aria-label={`Open ${template.name} in the editor`}
      className="group/card relative block w-[15rem] shrink-0 overflow-hidden rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm transition-colors hover:border-primary/60 sm:w-[19rem]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[9px] ring-1 ring-foreground/10">
        <ShimmerImage
          src={template.thumbnail}
          alt={template.name}
          className="size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
        />
        {animated && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/0 transition-colors group-hover/card:bg-foreground/10">
            <RiPlayCircleFill className="size-9 text-white/85 opacity-80 drop-shadow-md transition group-hover/card:scale-110" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-1.5 py-2">
        {animated ? (
          <RiVideoLine className="size-3.5 shrink-0 text-primary" />
        ) : (
          <RiImageLine className="size-3.5 shrink-0 text-foreground/40" />
        )}
        <span className="truncate text-[12.5px] font-medium tracking-tight text-foreground/80">
          {template.name}
        </span>
        <span className="ml-auto font-mono text-[9px] tracking-[0.18em] text-foreground/30 uppercase">
          {animated ? "Motion" : "Still"}
        </span>
      </div>
    </Link>
  )
}

export function TemplatesShowcase() {
  return (
    <section
      id="templates"
      className="relative overflow-hidden px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65, ease }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center"
      >
        <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
          {"// Templates"}
        </span>
        <h2 className="text-2xl tracking-tight sm:text-3xl lg:text-4xl">
          Start from a template, not a blank canvas.
        </h2>
        <p className="max-w-xl text-sm leading-7 text-foreground/58">
          Ready-made compositions with frames, backdrops, shadows, and layouts
          already dialed in — including animated reveals that play out on a
          timeline. Pick one, drop in your capture, and it&rsquo;s export-ready.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        className={cn(
          "relative mt-12 flex flex-col gap-4",
          // Fade the rails out at both edges so cards enter and exit softly.
          "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        )}
      >
        <Marquee pauseOnHover repeat={4} className="py-0 [--duration:64s]">
          {ROW_ONE.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </Marquee>
        <Marquee
          reverse
          pauseOnHover
          repeat={4}
          className="py-0 [--duration:72s]"
        >
          {ROW_TWO.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </Marquee>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease, delay: 0.15 }}
        className="mt-12 flex justify-center"
      >
        <Link
          href="/showcase"
          className="group inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground/80 backdrop-blur-sm transition hover:border-primary/50 hover:text-foreground"
        >
          Browse all templates
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </section>
  )
}
