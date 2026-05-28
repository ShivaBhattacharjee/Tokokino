"use client"

import * as React from "react"
import { RiLayoutMasonryLine, RiSettingsLine } from "@remixicon/react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"

import {
  AccountTile,
  EffectsSidebar,
} from "@/components/editor/effects-sidebar"
import { Inspector } from "@/components/editor/inspector"
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
  const [direction, setDirection] = React.useState<number>(1)

  const handleTabChange = (id: TabId) => {
    if (id === activeTab) return
    const newDir = TAB_ORDER.indexOf(id) > TAB_ORDER.indexOf(activeTab) ? 1 : -1
    setDirection(newDir)
    setActiveTab(id)
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[264px] shrink-0 flex-col overflow-hidden border-r border-dashed border-border/70 bg-sidebar lg:w-[288px]",
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

      {/* Content with directional slide transition */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            {activeTab === "design" ? (
              <EffectsSidebar
                hideAccount
                className="!h-full !w-full !border-none !bg-transparent"
              />
            ) : (
              <Inspector className="!h-full !w-full !border-none !bg-transparent" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <AccountTile />
    </aside>
  )
}
