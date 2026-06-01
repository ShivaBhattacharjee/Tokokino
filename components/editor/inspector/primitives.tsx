"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiGradienterLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  collapsible = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  defaultOpen?: boolean
  /** When false the section is always expanded and the toggle chevron is hidden. */
  collapsible?: boolean
  children: React.ReactNode
}) {
  const [openState, setOpen] = React.useState(defaultOpen)
  const open = collapsible ? openState : true
  return (
    <div>
      <button
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        className={cn(
          "flex w-full items-center gap-2 py-1.5 text-left",
          collapsible && "cursor-pointer"
        )}
      >
        {collapsible ? (
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.18 }}
            className="inline-flex size-4 items-center justify-center text-muted-foreground"
          >
            <RiArrowDownSLine className="size-4" />
          </motion.span>
        ) : null}
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
          <Icon className="size-3" />
        </span>
        <span className="text-[13px] font-medium">{title}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1 pl-4 xl:pl-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function SubHeader({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between text-[11px] tracking-tight text-muted-foreground">
      <span>{children}</span>
      {trailing}
    </div>
  )
}

export function PopoverHeader({
  title,
  description,
  onReset,
  resetTitle,
}: {
  title: string
  description: string
  onReset?: () => void
  resetTitle?: string
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] leading-tight font-medium">
            {title}
          </span>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            {description}
          </p>
        </div>
        {onReset ? (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-0.5 size-6 shrink-0 cursor-pointer"
            onClick={onReset}
            title={resetTitle ?? "Reset"}
          >
            <RiArrowGoBackLine className="size-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

const presetTileBaseClass =
  "w-full overflow-hidden rounded-md border cursor-pointer"
const presetTileAspectClass = {
  square: "aspect-square",
  rect: "aspect-[4/3]",
} as const
const presetActiveClass =
  "border-transparent ring-1 ring-primary/35 ring-offset-1 ring-offset-sidebar"
const presetIdleClass = "border-border/60"

/** A grid of color preset tiles + a custom color picker tile. Used by border, shadow, and solid background. */
export function ColorPresetGrid({
  presets,
  selected,
  onSelect,
  customColor,
  onCustomColor,
  isCustom,
  customLabel = "Custom color",
  tileShape = "square",
}: {
  presets: string[]
  selected: string | null
  onSelect: (color: string) => void
  customColor: string
  onCustomColor: (hex: string) => void
  isCustom: boolean
  customLabel?: string
  tileShape?: "square" | "rect"
}) {
  const tileClass = cn(presetTileBaseClass, presetTileAspectClass[tileShape])
  return (
    <div className="grid grid-cols-4 gap-2 px-1 py-1 md:grid-cols-3">
      {[...new Set(presets.map((c) => c.toLowerCase()))].map((c) => {
        const active =
          selected !== null && selected.toLowerCase() === c.toLowerCase()
        return (
          <div key={c} className="relative">
            <button
              onClick={() => onSelect(c)}
              className={cn(
                tileClass,
                active ? presetActiveClass : presetIdleClass
              )}
            >
              <span
                className="block size-full rounded-[inherit]"
                style={{ background: c }}
              />
            </button>
          </div>
        )
      })}
      <div className="relative">
        <ColorPickerPopover value={customColor} onChange={onCustomColor}>
          <button
            className={cn(
              "relative",
              tileClass,
              isCustom ? presetActiveClass : presetIdleClass
            )}
            aria-label={customLabel}
          >
            <span
              className="block size-full rounded-[inherit]"
              style={{
                background: isCustom ? customColor : "transparent",
                backgroundImage: isCustom
                  ? undefined
                  : "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)",
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/35 text-white">
              <RiGradienterLine className="size-3.5" />
            </span>
          </button>
        </ColorPickerPopover>
      </div>
    </div>
  )
}
