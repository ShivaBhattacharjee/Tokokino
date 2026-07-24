"use client"

import * as React from "react"
import Link from "next/link"
import { LayoutGroup, motion } from "motion/react"
import { RiImageLine, RiPlayCircleFill, RiVideoLine } from "@remixicon/react"

import {
  TEMPLATE_CATALOG,
  templateEditorHref,
  type TemplateCategory,
  type TemplateMeta,
} from "@/lib/editor/templates/catalog"
import { ease } from "@/components/landing/constants"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"

type Tab = "all" | TemplateCategory

const TABS: Tab[] = ["all", "image", "animation"]
const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  image: "Image",
  animation: "Animation",
}

function TabIcon({ tab }: { tab: Tab }) {
  if (tab === "image") return <RiImageLine className="size-4" />
  if (tab === "animation") return <RiVideoLine className="size-4" />
  return null
}

function SegmentedTabs({
  tab,
  onChange,
}: {
  tab: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <LayoutGroup id="showcase-tabs">
      <div className="flex w-max items-center gap-1 rounded-md border border-border/60 bg-background/50 p-1 backdrop-blur-sm">
        {TABS.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={cn(
                "relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "text-primary-foreground"
                  : "text-foreground/60 hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="showcase-tabs-pill"
                  className="absolute inset-0 rounded-md bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-2">
                <TabIcon tab={t} />
                {TAB_LABELS[t]}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function TemplateCard({ template }: { template: TemplateMeta }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const animated = template.category === "animation"

  const handleEnter = () => {
    const video = videoRef.current
    if (!video) return
    void video
      .play()
      .then(() => setPlaying(true))
      .catch(() => {})
  }

  const handleLeave = () => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
    setPlaying(false)
  }

  return (
    <Link
      href={templateEditorHref(template.id)}
      aria-label={`Open ${template.name} in the editor`}
      onMouseEnter={animated ? handleEnter : undefined}
      onMouseLeave={animated ? handleLeave : undefined}
      className="group/card flex flex-col gap-2 text-left"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-secondary/40 ring-1 ring-foreground/10 transition-shadow group-hover/card:shadow-lg group-hover/card:ring-2 group-hover/card:ring-primary">
        <ShimmerImage
          src={template.thumbnail}
          alt={template.name}
          className={cn(
            "size-full object-cover transition-opacity",
            animated && playing ? "opacity-0" : "opacity-100"
          )}
        />
        {animated && template.preview && (
          <>
            <video
              ref={videoRef}
              src={template.preview}
              poster={template.thumbnail}
              muted
              loop
              playsInline
              preload="none"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity",
                playing ? "opacity-100" : "opacity-0"
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute inset-0 grid place-items-center transition-opacity",
                playing ? "opacity-0" : "opacity-100"
              )}
            >
              <RiPlayCircleFill className="size-11 text-white/85 drop-shadow-md" />
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-0.5">
        {animated ? (
          <RiVideoLine className="size-3.5 shrink-0 text-primary" />
        ) : (
          <RiImageLine className="size-3.5 shrink-0 text-foreground/40" />
        )}
        <span className="truncate text-[13px] font-medium text-foreground/85">
          {template.name}
        </span>
        <span className="ml-auto font-mono text-[9px] tracking-[0.18em] text-foreground/30 uppercase">
          {animated ? "Motion" : "Still"}
        </span>
      </div>
    </Link>
  )
}

export function ShowcaseGrid() {
  const [tab, setTab] = React.useState<Tab>("all")
  const templates = React.useMemo(
    () =>
      tab === "all"
        ? TEMPLATE_CATALOG
        : TEMPLATE_CATALOG.filter((t) => t.category === tab),
    [tab]
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-start">
        <SegmentedTabs tab={tab} onChange={setTab} />
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 items-start gap-x-4 gap-y-6 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {templates.map((template, i) => (
          <motion.div
            key={template.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: Math.min(i, 8) * 0.03 }}
          >
            <TemplateCard template={template} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
