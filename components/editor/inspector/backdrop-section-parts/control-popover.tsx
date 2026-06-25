"use client"

import * as React from "react"
import { RiArrowGoBackLine, RiArrowLeftLine } from "@remixicon/react"
import { motion } from "motion/react"

import { ScrollFadeBody } from "@/components/editor/scroll-fade"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { PopoverHeader } from "../primitives"

function BackdropTile({
  icon: Icon,
  label,
  active,
  onClick,
  ...rest
}: React.ComponentProps<"button"> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "" : undefined}
      className={cn(
        "group relative flex h-[64px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border transition-all",
        active
          ? "border-primary/40 bg-primary/5 text-primary ring-1 ring-primary/20"
          : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        "data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 data-[state=open]:text-primary data-[state=open]:ring-1 data-[state=open]:ring-primary/20"
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </button>
  )
}

export function BackdropControlPopover({
  icon,
  label,
  active,
  title,
  description,
  onReset,
  resetTitle,
  children,
  footer,
  className,
  contentClassName,
  bodyClassName,
  footerClassName,
  open,
  onOpenChange,
  forceMount,
  popoverSide = "left",
  presentation = "popover",
  hideTriggerWhenOpen = false,
  inlineBodyMode = "carousel",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  title: string
  description: string
  onReset?: () => void
  resetTitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
  bodyClassName?: string
  footerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  forceMount?: true
  popoverSide?: "left" | "top"
  presentation?: "popover" | "inline"
  hideTriggerWhenOpen?: boolean
  inlineBodyMode?: "carousel" | "content"
}) {
  const [localOpen, setLocalOpen] = React.useState(false)
  const resolvedOpen = open ?? localOpen
  const setResolvedOpen = onOpenChange ?? setLocalOpen
  const closeInlinePanel = React.useCallback(() => {
    setResolvedOpen(false)
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => {
      document
        .querySelector("[data-mobile-backdrop-scroll]")
        ?.scrollTo({ top: 0 })
    })
  }, [setResolvedOpen])

  if (presentation === "inline") {
    return (
      <>
        {hideTriggerWhenOpen && resolvedOpen ? null : (
          <BackdropTile
            icon={icon}
            label={label}
            active={active}
            aria-expanded={resolvedOpen}
            data-state={resolvedOpen ? "open" : "closed"}
            onClick={() => setResolvedOpen(!resolvedOpen)}
          />
        )}
        {resolvedOpen ? (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-3 min-h-0"
          >
            <div
              className={cn(
                "mt-1 flex min-h-0 flex-col rounded-lg bg-sidebar/70 py-2",
                presentation !== "inline" && "px-2",
                contentClassName,
                className,
                "!w-full"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closeInlinePanel}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <RiArrowLeftLine className="size-4" />
                  Back
                </button>
                <span className="min-w-0 flex-1 text-center text-[13px] font-medium text-foreground">
                  {title}
                </span>
                {onReset ? (
                  <button
                    type="button"
                    onClick={onReset}
                    title={resetTitle ?? "Reset"}
                    aria-label={resetTitle ?? "Reset"}
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  >
                    <RiArrowGoBackLine className="size-4" />
                  </button>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden />
                )}
              </div>
              {presentation === "inline" && inlineBodyMode === "content" ? (
                <div className={cn("min-h-0", bodyClassName)}>{children}</div>
              ) : (
                <ScrollFadeBody
                  rootClassName={
                    presentation === "inline" && inlineBodyMode === "carousel"
                      ? "shrink-0"
                      : undefined
                  }
                  className={cn(
                    presentation === "inline" && inlineBodyMode === "carousel"
                      ? "max-h-[156px]"
                      : "max-h-[min(170px,calc(100vh-18rem))]",
                    bodyClassName
                  )}
                  fadeClassName="from-sidebar"
                >
                  {children}
                </ScrollFadeBody>
              )}
              {footer ? (
                <div
                  className={cn(
                    "shrink-0 bg-sidebar/80 py-2",
                    presentation === "inline"
                      ? "mt-0 -mb-2"
                      : "-mx-2 mt-2 -mb-2 border-t border-border/40 px-2",
                    footerClassName
                  )}
                >
                  {footer}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <BackdropTile icon={icon} label={label} active={active} />
      </PopoverTrigger>
      <PopoverContent
        side={popoverSide}
        align={popoverSide === "top" ? "center" : "start"}
        collisionPadding={8}
        forceMount={forceMount}
        className={cn(
          "w-[260px] gap-2 overflow-hidden bg-popover/95 p-2 backdrop-blur-md",
          contentClassName,
          className
        )}
      >
        <PopoverHeader
          title={title}
          description={description}
          onReset={onReset}
          resetTitle={resetTitle}
        />
        <ScrollFadeBody
          className={cn("max-h-[min(220px,calc(100vh-10rem))]", bodyClassName)}
        >
          {children}
        </ScrollFadeBody>
        {footer ? (
          <div
            className={cn(
              "-mx-2 -mb-2 shrink-0 border-t border-border/40 bg-popover px-2 py-2",
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
