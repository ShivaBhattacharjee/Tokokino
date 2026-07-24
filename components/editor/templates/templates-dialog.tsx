"use client"

import * as React from "react"
import { LayoutGroup, motion } from "motion/react"
import {
  RiCloseLine,
  RiImageLine,
  RiPlayCircleFill,
  RiVideoLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import {
  templateCountForTab,
  templatesForTab,
  templateTabLabel,
} from "@/lib/editor/templates"
import type { Template, TemplateTab } from "@/lib/editor/templates"
import { cn } from "@/lib/utils"

const DIALOG_SHELL =
  "flex h-[min(720px,calc(100dvh-1.5rem))] w-[min(calc(100vw-1.5rem),1080px)] flex-col gap-0 overflow-hidden rounded-md bg-background p-0 sm:max-w-[1080px]"

const TABS: TemplateTab[] = ["all", "image", "animation"]

function TabIcon({ tab }: { tab: TemplateTab }) {
  if (tab === "image") return <RiImageLine className="size-4" />
  if (tab === "animation") return <RiVideoLine className="size-4" />
  return null
}

function SegmentedTabs({
  tab,
  onChange,
}: {
  tab: TemplateTab
  onChange: (t: TemplateTab) => void
}) {
  return (
    <LayoutGroup id="templates-tabs">
      <div className="flex w-max items-center gap-1 rounded-xl bg-secondary/50 p-1">
        {TABS.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={cn(
                "relative flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-medium transition-colors",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="templates-tabs-pill"
                  className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <TabIcon tab={t} />
                {templateTabLabel(t)}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function TemplateCard({
  template,
  onApply,
}: {
  template: Template
  onApply: (t: Template) => void | Promise<void>
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const isAnimation = template.category === "animation"

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
    <button
      type="button"
      onClick={() => {
        void onApply(template)
      }}
      onMouseEnter={isAnimation ? handleEnter : undefined}
      onMouseLeave={isAnimation ? handleLeave : undefined}
      className="group flex flex-col gap-2 text-left"
    >
      {/* Fixed aspect so the shimmer fills the card before the poster paints
          (h-auto collapsed to 0 height and left only the title visible). */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-secondary/40 ring-1 ring-foreground/10 transition-shadow group-hover:shadow-lg group-hover:ring-2 group-hover:ring-primary">
        <ShimmerImage
          src={template.thumbnail}
          alt={template.name}
          className={cn(
            "size-full object-cover transition-opacity",
            isAnimation && playing ? "opacity-0" : "opacity-100"
          )}
        />
        {isAnimation && template.preview && (
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
        {isAnimation ? (
          <RiVideoLine className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <RiImageLine className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-[13px] font-medium text-foreground">
          {template.name}
        </span>
      </div>
    </button>
  )
}

function EmptyState({ tab }: { tab: TemplateTab }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <RiImageLine className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">
        No {tab === "all" ? "" : templateTabLabel(tab).toLowerCase() + " "}
        templates yet
      </p>
      <p className="max-w-xs text-[13px] text-muted-foreground">
        Pre-made compositions will show up here once they&rsquo;re published.
      </p>
    </div>
  )
}

export function TemplatesDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (template: Template) => void | Promise<void>
}) {
  const [tab, setTab] = React.useState<TemplateTab>("all")
  const templates = templatesForTab(tab)

  const handleApply = React.useCallback(
    async (template: Template) => {
      await onApply(template)
      onOpenChange(false)
    },
    [onApply, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_SHELL} showCloseButton={false}>
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close templates"
            className="absolute top-3 right-3 z-20 cursor-pointer rounded-sm bg-foreground/8 text-foreground/60 ring-1 ring-border/50 backdrop-blur-sm hover:bg-foreground/12 hover:text-foreground"
          >
            <RiCloseLine />
          </Button>
        </DialogClose>

        <DialogHeader className="flex-col items-start gap-3 space-y-0 border-b border-border/60 px-4 py-4 pr-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pl-6">
          <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            Templates
          </DialogTitle>
          <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            <SegmentedTabs tab={tab} onChange={setTab} />
          </div>
        </DialogHeader>

        {templateCountForTab(tab) === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-5 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onApply={handleApply}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
