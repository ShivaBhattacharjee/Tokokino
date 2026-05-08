"use client"

import * as React from "react"
import {
  RiBrushLine,
  RiLayoutGrid2Line,
  RiMoonClearLine,
  RiPaletteLine,
  RiRotateLockLine,
  RiSunLine,
} from "@remixicon/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { BackdropSection } from "./inspector/backdrop-section"
import { BackgroundSection } from "./inspector/background-section"
import { BorderSection } from "./inspector/border-section"
import { PaddingSection } from "./inspector/padding-section"
import { Section } from "./inspector/primitives"
import { ShadowSection } from "./inspector/shadow-section"
import { TiltSection } from "./inspector/tilt-section"

export function Inspector({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[308px] shrink-0 flex-col border-l border-dashed border-border/70 bg-sidebar overflow-hidden",
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <span className="text-[13px] font-medium tracking-tight">Properties</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3 pb-24">
          <Section icon={RiPaletteLine} title="Background" defaultOpen>
            <BackgroundSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiSunLine} title="Backdrop">
            <BackdropSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiBrushLine} title="Border" defaultOpen>
            <BorderSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiLayoutGrid2Line} title="Padding" defaultOpen>
            <PaddingSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiRotateLockLine} title="Tilt & Scale" defaultOpen>
            <TiltSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiMoonClearLine} title="Shadow" defaultOpen>
            <ShadowSection />
          </Section>
        </div>
      </ScrollArea>
    </aside>
  )
}
