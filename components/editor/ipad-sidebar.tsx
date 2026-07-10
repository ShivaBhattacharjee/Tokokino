"use client"

import * as React from "react"
import { RiLayoutMasonryLine, RiSettingsLine } from "@remixicon/react"
import { LayoutGroup, motion } from "motion/react"

import {
  AccountTile,
  EffectsSidebar,
} from "@/components/editor/effects-sidebar"
import { Inspector } from "@/components/editor/inspector"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type TabId = "design" | "tools"

const TABS: {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "design", label: "Design", icon: RiLayoutMasonryLine },
  { id: "tools", label: "Tools", icon: RiSettingsLine },
]

const TAB_ORDER: TabId[] = ["design", "tools"]

/**
 * Always-visible left sidebar for iPad widths (md ≤ w < xl).
 * Folds both control panels into one panel via Design / Tools tabs.
 * Below md the bottom MobileControls panel is used; at xl+ the two inline
 * EffectsSidebar / Inspector panels are rendered instead.
 */
export function IpadSidebar({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = React.useState<TabId>("design")
  const touchStartX = React.useRef<number | null>(null)
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)

  // Animate mode's controls (Position etc.) live on the Tools panel, so jump to
  // it when entering animate mode. The user can still swipe back to Design.
  React.useEffect(() => {
    if (isAnimateMode) setActiveTab("tools")
  }, [isAnimateMode])

  const handleTabChange = (id: TabId) => {
    if (id === activeTab) return
    setActiveTab(id)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 50) return
    const currentIdx = TAB_ORDER.indexOf(activeTab)
    const nextIdx = delta < 0 ? currentIdx + 1 : currentIdx - 1
    const nextTab = TAB_ORDER[nextIdx]
    if (nextTab) handleTabChange(nextTab)
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[256px] shrink-0 flex-col overflow-hidden border-r border-dashed border-border/70 bg-sidebar lg:w-[280px]",
        className
      )}
    >
      {/* Tab strip — no container background, tabs float */}
      <div className="shrink-0 border-b border-border/60 px-3 pt-2.5 pb-2">
        <LayoutGroup id="ipad-sidebar-tabs">
          <div className="flex h-11 w-full items-center gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "relative flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="ipad-tab-pill"
                      className="absolute inset-0 rounded-md bg-foreground/[0.07] ring-1 ring-border/50"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <tab.icon className="size-4" />
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </div>

      {/* Both panels stay mounted; a single GPU-composited transform slides
          between them. Avoids remounting the heavy panel trees on every tab
          switch, which is what caused the touch lag. */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ contain: "layout style" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          className="flex h-full w-[200%]"
          animate={{ x: activeTab === "design" ? "0%" : "-50%" }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          style={{ willChange: "transform" }}
        >
          <div
            className="h-full w-1/2 shrink-0 overflow-hidden"
            aria-hidden={activeTab !== "design"}
            style={{ pointerEvents: activeTab === "design" ? "auto" : "none" }}
          >
            <EffectsSidebar
              hideAccount
              popoverAlign="end"
              className="!h-full !w-full !border-none !bg-transparent"
            />
          </div>
          <div
            className="h-full w-1/2 shrink-0 overflow-hidden"
            aria-hidden={activeTab !== "tools"}
            style={{ pointerEvents: activeTab === "tools" ? "auto" : "none" }}
          >
            <Inspector className="!h-full !w-full !border-none !bg-transparent" />
          </div>
        </motion.div>
      </div>
      <AccountTile />
    </aside>
  )
}
