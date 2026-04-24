"use client"

import * as React from "react"
import { RiLayoutMasonryLine } from "@remixicon/react"

import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

/**
 * Sheet-triggered design panel for iPad Pro widths (lg ≤ w < xl).
 * Below lg the bottom MobileControls panel is used instead.
 * At xl+ the EffectsSidebar is rendered inline.
 */
export function IpadProSidebar() {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Open design panel"
          className="absolute top-4 left-4 z-20 hidden bg-popover/90 shadow-md backdrop-blur-md lg:inline-flex xl:hidden"
        >
          <RiLayoutMasonryLine />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="!inset-y-0">
        <DrawerTitle className="sr-only">Design</DrawerTitle>
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <EffectsSidebar
            stacked
            className="!h-full !w-full !border-none !bg-transparent"
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
