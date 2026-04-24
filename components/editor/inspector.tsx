"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiLayoutGrid2Line,
  RiPaletteLine,
  RiRotateLockLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export function Inspector() {
  return (
    <aside className="flex h-full w-[308px] shrink-0 flex-col border-l border-border/60 bg-sidebar">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium tracking-tight">
            Inspector
          </span>
        </div>
        <span className="tabular rounded border border-border/60 bg-secondary/60 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          Browser
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          <Section icon={RiPaletteLine} title="Background" defaultOpen>
            <BackgroundSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiLayoutGrid2Line} title="Padding" defaultOpen>
            <PaddingSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiRotateLockLine} title="Tilt & Scale" defaultOpen>
            <TiltSection />
          </Section>
        </div>
      </ScrollArea>
    </aside>
  )
}

/* -------- Section primitive -------- */

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1.5 text-left"
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.18 }}
          className="inline-flex size-4 items-center justify-center text-muted-foreground"
        >
          <RiArrowDownSLine className="size-4" />
        </motion.span>
        <span className="inline-flex size-5 items-center justify-center rounded-md border border-border/60 bg-secondary/60 text-muted-foreground">
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
            <div className="pt-2 pb-1 pl-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] tracking-tight text-muted-foreground">
      {children}
    </div>
  )
}

/* -------- Background -------- */

function BackgroundSection() {
  const [pattern, setPattern] = React.useState(1)
  const [color, setColor] = React.useState(0)
  const [grain, setGrain] = React.useState(0)

  const patterns = [
    // solid
    "bg-background",
    // dots
    "bg-background [background-image:radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.2)_1px,_transparent_1px)] [background-size:8px_8px]",
    // grid
    "bg-background [background-image:linear-gradient(oklch(from_var(--foreground)_l_c_h_/_0.15)_1px,_transparent_1px),linear-gradient(90deg,oklch(from_var(--foreground)_l_c_h_/_0.15)_1px,_transparent_1px)] [background-size:10px_10px]",
    // diagonals
    "bg-background [background-image:repeating-linear-gradient(-45deg,oklch(from_var(--foreground)_l_c_h_/_0.12)_0_1px,transparent_1px_6px)]",
    // noise
    "bg-background [background-image:radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.08)_1px,transparent_1px),radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.05)_1px,transparent_1px)] [background-size:7px_7px,11px_11px] [background-position:0_0,3px_3px]",
    // warm tint
    "bg-[oklch(0.96_0.03_80)]",
  ]

  const colors = [
    "oklch(1 0 0)",
    "oklch(0.94 0 0)",
    "oklch(0.82 0 0)",
    "oklch(0.55 0 0)",
    "oklch(0.32 0 0)",
    "oklch(0.16 0 0)",
    "transparent",
  ]

  return (
    <>
      <SubHeader>Pattern</SubHeader>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {patterns.map((cls, i) => (
          <button
            key={i}
            onClick={() => setPattern(i)}
            className={cn(
              "relative aspect-square overflow-hidden rounded-md border transition-colors",
              pattern === i
                ? "border-foreground/60"
                : "border-border/60 hover:border-foreground/25",
              cls
            )}
          >
            {pattern === i ? (
              <span className="absolute top-1 right-1 inline-flex size-3 items-center justify-center rounded-full bg-foreground text-[8px] text-background">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <SubHeader>Color</SubHeader>
      <div className="mb-4 flex items-center gap-1.5">
        {colors.map((c, i) => (
          <button
            key={i}
            onClick={() => setColor(i)}
            className={cn(
              "size-6 shrink-0 rounded-md border transition-transform",
              color === i
                ? "border-foreground/60 ring-1 ring-foreground/30 ring-offset-2 ring-offset-sidebar"
                : "border-border/60 hover:-translate-y-0.5",
              c === "transparent" &&
                "bg-checker"
            )}
            style={c !== "transparent" ? { background: c } : undefined}
            aria-label={`Color ${i + 1}`}
          />
        ))}
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Grain</span>
        <span className="tabular font-mono text-[11px] text-foreground/80">
          {grain}
        </span>
      </div>
      <Slider
        value={[grain]}
        onValueChange={([v]) => setGrain(v)}
        max={100}
      />
    </>
  )
}

/* -------- Padding -------- */

function PaddingSection() {
  const [inset, setInset] = React.useState(90)
  const quick = [40, 80, 120, 160]
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Inset</span>
        <span className="tabular font-mono text-[11px] text-foreground/80">
          {inset}px
        </span>
      </div>
      <Slider
        value={[inset]}
        onValueChange={([v]) => setInset(v)}
        max={240}
        className="mb-3"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setInset(q)}
            className={cn(
              "tabular h-8 rounded-md border font-mono text-[11px] transition-colors",
              inset === q
                ? "border-transparent bg-foreground text-background"
                : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-foreground/25"
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </>
  )
}

/* -------- Tilt & Scale -------- */

function TiltSection() {
  const [rx, setRx] = React.useState(6)
  const [ry, setRy] = React.useState(-10)
  const [rz, setRz] = React.useState(-2)
  const [scale, setScale] = React.useState(95)
  return (
    <>
      <DegreeRow label="Rotate X" value={rx} onChange={setRx} />
      <DegreeRow label="Rotate Y" value={ry} onChange={setRy} />
      <DegreeRow label="Rotate Z" value={rz} onChange={setRz} />
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Scale</span>
        <span className="tabular font-mono text-[11px] text-foreground/80">
          {scale}%
        </span>
      </div>
      <Slider
        value={[scale]}
        onValueChange={([v]) => setScale(v)}
        min={50}
        max={150}
      />
    </>
  )
}

function DegreeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="tabular font-mono text-[11px] text-foreground/80">
          {value}°
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={-45}
        max={45}
      />
    </div>
  )
}
