"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { RiArrowRightSLine, RiLayoutGridLine } from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PresetTab = "single" | "multi" | "triple" | "custom"

export type CanvasPresetUi = {
  tab: PresetTab
  activeLayoutPresetId: string | null
  activeSinglePresetId: string | null
  activeCustomPresetId: string | null
}

export function emptyCanvasPresetUi(tab: PresetTab): CanvasPresetUi {
  return {
    tab,
    activeLayoutPresetId: null,
    activeSinglePresetId: null,
    activeCustomPresetId: null,
  }
}

const TAB_LABELS: Record<PresetTab, string> = {
  single: "Single",
  multi: "Multi",
  triple: "Triple",
  custom: "Custom",
}

function TabIcon({ t, active }: { t: PresetTab; active: boolean }) {
  const fill = active ? "text-primary/40" : "text-foreground/20"
  const stroke = active ? "text-primary/70" : "text-foreground/30"
  const fillSm = active ? "text-primary/30" : "text-foreground/15"
  const strokeSm = active ? "text-primary/60" : "text-foreground/25"

  if (t === "single") {
    return (
      <svg
        width="44"
        height="30"
        viewBox="0 0 44 30"
        fill="none"
        className="shrink-0"
      >
        <rect
          x="8"
          y="4"
          width="28"
          height="22"
          rx="3"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="8"
          y="4"
          width="28"
          height="22"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
      </svg>
    )
  }
  if (t === "multi") {
    return (
      <svg
        width="44"
        height="30"
        viewBox="0 0 44 30"
        fill="none"
        className="shrink-0"
      >
        <rect
          x="2"
          y="6"
          width="20"
          height="18"
          rx="2.5"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="2"
          y="6"
          width="20"
          height="18"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="24"
          y="9"
          width="18"
          height="15"
          rx="2"
          fill="currentColor"
          className={fillSm}
        />
        <rect
          x="24"
          y="9"
          width="18"
          height="15"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={strokeSm}
        />
      </svg>
    )
  }
  if (t === "triple") {
    return (
      <svg
        width="44"
        height="30"
        viewBox="0 0 44 30"
        fill="none"
        className="shrink-0"
      >
        <rect
          x="1"
          y="8"
          width="13"
          height="14"
          rx="2"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="1"
          y="8"
          width="13"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="16"
          y="6"
          width="12"
          height="18"
          rx="2"
          fill="currentColor"
          className={fill}
        />
        <rect
          x="16"
          y="6"
          width="12"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={stroke}
        />
        <rect
          x="30"
          y="8"
          width="13"
          height="14"
          rx="2"
          fill="currentColor"
          className={fillSm}
        />
        <rect
          x="30"
          y="8"
          width="13"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          className={strokeSm}
        />
      </svg>
    )
  }

  return (
    <svg
      width="44"
      height="30"
      viewBox="0 0 44 30"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M22 4 L26.6 13.5 L37 14.6 L29.5 21.6 L31.5 32 L22 26.8 L12.5 32 L14.5 21.6 L7 14.6 L17.4 13.5 Z"
        fill="currentColor"
        className={fill}
      />
      <path
        d="M22 4 L26.6 13.5 L37 14.6 L29.5 21.6 L31.5 32 L22 26.8 L12.5 32 L14.5 21.6 L7 14.6 L17.4 13.5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className={stroke}
      />
    </svg>
  )
}

function isTabDisabled(
  t: PresetTab,
  slotCount: number,
  hasTweet: boolean
): boolean {
  if (hasTweet && (t === "multi" || t === "triple")) return true
  if (t === "multi") return slotCount > 2
  if (t === "triple") return slotCount > 2
  return false
}

const PRESET_TABS: PresetTab[] = ["single", "multi", "triple", "custom"]

export function TabTriggerRow({
  tab,
  slotCount,
  hasTweet = false,
  onTabChange,
}: {
  tab: PresetTab
  slotCount: number
  hasTweet?: boolean
  onTabChange: (t: PresetTab) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex h-11 w-full items-center gap-2.5 rounded-lg bg-secondary/40 px-3 text-left transition-colors hover:bg-secondary/70",
            open && "bg-secondary/70"
          )}
        >
          <span className="inline-flex size-5 items-center justify-center text-foreground/60">
            <RiLayoutGridLine className="size-4" />
          </span>
          <span className="flex-1 text-[13px] font-medium text-foreground capitalize">
            {TAB_LABELS[tab]}
          </span>
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        forceMount
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] overflow-visible border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full rounded-lg bg-popover p-1.5 shadow-md ring-1 ring-foreground/10"
            >
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_TABS.map((t) => {
                    const disabled = isTabDisabled(t, slotCount, hasTweet)
                    const disabledReason =
                      hasTweet && (t === "multi" || t === "triple")
                        ? "Social posts use one content slot."
                        : t === "multi"
                          ? "Multi supports up to 2 screenshot boxes. Delete slots to switch."
                          : "Triple supports up to 3 screenshot boxes. Delete a slot to switch."
                    return (
                      <Tooltip key={t} open={disabled ? undefined : false}>
                        <TooltipTrigger asChild>
                          <button
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return
                              setOpen(false)
                              onTabChange(t)
                            }}
                            className={cn(
                              "flex flex-1 flex-col items-center gap-2 rounded-lg border p-2.5 transition-colors",
                              tab === t
                                ? "border-primary bg-primary/10"
                                : disabled
                                  ? "cursor-not-allowed border-border/30 bg-secondary/15 opacity-40"
                                  : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
                            )}
                          >
                            <TabIcon t={t} active={tab === t} />
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                tab === t
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              )}
                            >
                              {TAB_LABELS[t]}
                            </span>
                          </button>
                        </TooltipTrigger>
                        {disabled && (
                          <TooltipContent side="bottom" sideOffset={6}>
                            {disabledReason}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}
