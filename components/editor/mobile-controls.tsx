"use client"

import * as React from "react"
import {
  RiLayoutMasonryLine,
  RiSettingsLine,
} from "@remixicon/react"

import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { Inspector } from "@/components/editor/inspector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/**
 * Bottom panel shown only on mobile (<md). Stacks under the canvas.
 * Tabs switch between Design (EffectsSidebar content) and Inspector.
 * Height is roughly 45vh so the canvas still gets the majority of the viewport.
 */
export function MobileControls() {
  return (
    <div
      className={cn(
        "flex h-[48svh] min-h-[320px] shrink-0 flex-col border-t border-border/60 bg-sidebar xl:hidden"
      )}
    >
      <Tabs
        defaultValue="design"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b border-border/60 px-3 pt-2.5 pb-2">
          <TabsList className="h-11 w-full p-1">
            <TabsTrigger
              value="design"
              className="h-9 gap-2 text-[13px] font-medium"
            >
              <RiLayoutMasonryLine className="size-4" />
              Design
            </TabsTrigger>
            <TabsTrigger
              value="inspector"
              className="h-9 gap-2 text-[13px] font-medium"
            >
              <RiSettingsLine className="size-4" />
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="design"
          className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
        >
          <EffectsSidebar className="!w-full !border-none !bg-transparent" />
        </TabsContent>

        <TabsContent
          value="inspector"
          className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
        >
          <Inspector className="!w-full !border-none !bg-transparent" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
