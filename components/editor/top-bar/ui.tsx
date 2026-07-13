"use client"

import * as React from "react"
import { RiArrowRightSLine } from "@remixicon/react"
import { LayoutGroup, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function SegmentedRow({
  options,
  value,
  onChange,
}: {
  options: {
    value: string
    label: string
    disabled?: boolean
    tooltip?: string
  }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <LayoutGroup
      id={`segmented-row-${options.map((opt) => opt.value).join("-")}`}
    >
      <div className="flex w-full items-center gap-1 rounded-full bg-secondary/50 p-1">
        {options.map((opt) => {
          const active = opt.value === value
          // Keep disabled options focusable/hoverable (aria-disabled, not the
          // `disabled` attribute) so their explanatory tooltip still shows.
          const button = (
            <button
              type="button"
              aria-disabled={opt.disabled || undefined}
              onClick={opt.disabled ? undefined : () => onChange(opt.value)}
              className={cn(
                "relative flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                opt.disabled
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : active
                    ? "cursor-pointer text-foreground"
                    : "cursor-pointer text-muted-foreground hover:text-foreground"
              )}
            >
              {active && !opt.disabled ? (
                <motion.span
                  layoutId={`segmented-pill-${options.map((o) => o.value).join("-")}`}
                  className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/60"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10">{opt.label}</span>
            </button>
          )
          if (opt.tooltip) {
            return (
              <Tooltip key={opt.value}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom">{opt.tooltip}</TooltipContent>
              </Tooltip>
            )
          }
          return <React.Fragment key={opt.value}>{button}</React.Fragment>
        })}
      </div>
    </LayoutGroup>
  )
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="rounded-full bg-secondary/60 px-2.5 py-1 font-mono text-[11px] text-foreground">
        {value}
      </span>
    </div>
  )
}

export function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  )
}

export function TopBarButton({
  label,
  icon: Icon,
  onClick,
  variant = "outline",
  tooltip,
  disabled,
  className,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  tooltip?: string
  disabled?: boolean
  className?: string
}) {
  const button = (
    <Button
      variant={variant}
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <Icon />
      <span className="hidden xl:inline">{label}</span>
    </Button>
  )

  if (!tooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function IconAction({
  label,
  icon: Icon,
  shortcut,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          aria-disabled={disabled || undefined}
          onClick={disabled ? undefined : onClick}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            disabled &&
              "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? (
          <kbd className="ml-1.5 font-mono text-[10px] opacity-80">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function SaveActionRow({
  icon: Icon,
  title,
  description,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-transparent bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground/80 ring-1 ring-border/50">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {loading ? "Saving…" : title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
