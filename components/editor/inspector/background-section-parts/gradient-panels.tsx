"use client"

import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { Background } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import {
  EXPAND_EASE,
  gradientCategoryIcon,
  GRADIENT_PREVIEW_COUNT,
  TILE_FADE_VARIANTS,
  TILE_GRID_VARIANTS,
  TILE_ITEM_VARIANTS,
  type GradientOption,
} from "./constants"
import { ExpandToggleTile } from "./expand-toggle-tile"
import { GradientCustomizerPopover } from "./gradient-customizer-popover"

type GradientCategoryOptions = {
  key: string
  label: string
  options: GradientOption[]
}

type GradientEditorProps = {
  background: Background
  gradientConfig: { angle: number; colors: string[] } | null
  canResetGradient: boolean
  setGradientAngle: (angle: number) => void
  setGradientColor: (colorIndex: number, colorValue: string) => void
  resetGradientEdits: () => void
}

type SetBackground = (background: Background) => void

export function GradientPanel({
  background,
  gradientCategoryOptions,
  gradientCategoryKey,
  setGradientCategoryKey,
  gradientExpanded,
  setGradientExpanded,
  gradientConfig,
  canResetGradient,
  setGradientAngle,
  setGradientColor,
  resetGradientEdits,
  setBackground,
}: GradientEditorProps & {
  gradientCategoryOptions: GradientCategoryOptions[]
  gradientCategoryKey: string
  setGradientCategoryKey: (key: string) => void
  gradientExpanded: boolean
  setGradientExpanded: (expanded: boolean) => void
  setBackground: SetBackground
}) {
  const activeCategory =
    gradientCategoryOptions.find((c) => c.key === gradientCategoryKey) ??
    gradientCategoryOptions[0]
  if (!activeCategory) return null
  const items = activeCategory.options
  const head = items.slice(0, GRADIENT_PREVIEW_COUNT)
  const hidden = items.slice(GRADIENT_PREVIEW_COUNT)
  const peek = hidden[0] ?? null

  const renderTile = (option: GradientOption, fade = false) => (
    <GradientTile
      key={option.id}
      option={option}
      activeCategoryKey={activeCategory.key}
      fade={fade}
      active={
        background.type === "gradient" && background.value === option.value
      }
      gradientConfig={gradientConfig}
      canResetGradient={canResetGradient}
      onSelect={() => setBackground({ type: "gradient", value: option.value })}
      setGradientAngle={setGradientAngle}
      setGradientColor={setGradientColor}
      resetGradientEdits={resetGradientEdits}
    />
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary/40 p-1">
        {gradientCategoryOptions.map((c) => {
          const active = c.key === activeCategory.key
          const CategoryIcon = gradientCategoryIcon(c.key)
          return (
            <button
              key={c.key}
              onClick={() => {
                setGradientCategoryKey(c.key)
                setGradientExpanded(false)
              }}
              className={cn(
                "relative flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[5px] px-3 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="gradient-category-pill"
                  className="absolute inset-0 rounded-[5px] bg-primary shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 32,
                  }}
                />
              ) : null}
              <CategoryIcon className="relative z-10 size-3.5 shrink-0" />
              <span className="relative z-10">{c.label}</span>
            </button>
          )
        })}
      </div>

      <motion.div
        layout
        transition={{ layout: { duration: 0.26, ease: EXPAND_EASE } }}
        className="relative w-full"
      >
        {/* Keep the ScrollArea mounted in both states — remounting it on expand
            would restart the whole grid's entrance animation instead of just
            animating in the newly revealed tiles. */}
        <ScrollArea
          className={cn(
            gradientExpanded && "*:data-[slot=scroll-area-viewport]:max-h-70"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`grad-${activeCategory.key}`}
              variants={TILE_GRID_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="grid grid-cols-3 gap-2 px-1 py-1 pr-2"
            >
              {head.map((option) => renderTile(option))}
              {/* The toggle keeps its slot in the grid in both states, so
                  expanding reveals the rest after it instead of moving the
                  control. */}
              {hidden.length > 0 ? (
                <ExpandToggleTile
                  expanded={gradientExpanded}
                  onToggle={() => setGradientExpanded(!gradientExpanded)}
                  hiddenCount={hidden.length}
                  peekStyle={peek ? { background: peek.value } : undefined}
                  title={
                    gradientExpanded
                      ? `Show fewer ${activeCategory.label.toLowerCase()} gradients`
                      : `Show all ${items.length} ${activeCategory.label.toLowerCase()} gradients`
                  }
                />
              ) : null}
              {gradientExpanded
                ? hidden.map((option) => renderTile(option, true))
                : null}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </motion.div>
    </div>
  )
}

function GradientTile({
  option,
  activeCategoryKey,
  active,
  fade = false,
  gradientConfig,
  canResetGradient,
  onSelect,
  setGradientAngle,
  setGradientColor,
  resetGradientEdits,
}: {
  option: GradientOption
  activeCategoryKey: string
  active: boolean
  fade?: boolean
  gradientConfig: { angle: number; colors: string[] } | null
  canResetGradient: boolean
  onSelect: () => void
  setGradientAngle: (angle: number) => void
  setGradientColor: (colorIndex: number, colorValue: string) => void
  resetGradientEdits: () => void
}) {
  return (
    <motion.div
      variants={fade ? TILE_FADE_VARIANTS : TILE_ITEM_VARIANTS}
      className="relative"
    >
      <button
        onClick={onSelect}
        className={cn(
          "relative aspect-video w-full cursor-pointer rounded-lg border",
          active ? "border-transparent" : "border-border/60"
        )}
      >
        <span
          className="block size-full rounded-[inherit]"
          style={{ background: option.value }}
        />
        {active ? (
          <motion.span
            layoutId={`gradient-tile-ring-${activeCategoryKey}`}
            className="pointer-events-none absolute -inset-0.5 rounded-[10px] ring-1 ring-primary/45"
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 32,
            }}
          />
        ) : null}
      </button>
      {active && gradientConfig ? (
        <div className="absolute inset-0">
          <GradientCustomizerPopover
            ariaLabel="Customize gradient"
            config={gradientConfig}
            canReset={canResetGradient}
            onAngleChange={setGradientAngle}
            onColorChange={setGradientColor}
            onReset={resetGradientEdits}
          />
        </div>
      ) : null}
    </motion.div>
  )
}

export function AutoGradientPanel({
  background,
  autoGradientOptions,
  gradientConfig,
  canResetGradient,
  setGradientAngle,
  setGradientColor,
  resetGradientEdits,
  setBackground,
}: GradientEditorProps & {
  autoGradientOptions: GradientOption[]
  setBackground: SetBackground
}) {
  return (
    <ScrollArea className="*:data-[slot=scroll-area-viewport]:max-h-70">
      <div className="grid grid-cols-3 gap-2 px-1 py-1 pr-2">
        {autoGradientOptions.map((option) => {
          const active =
            background.type === "auto" && background.value === option.value
          return (
            <div key={option.id} className="relative">
              <button
                onClick={() =>
                  setBackground({ type: "auto", value: option.value })
                }
                className={cn(
                  "relative aspect-video w-full cursor-pointer rounded-lg border",
                  active ? "border-transparent" : "border-border/60"
                )}
              >
                <span
                  className="block size-full rounded-[inherit]"
                  style={{ background: option.value }}
                />
                {active ? (
                  <motion.span
                    layoutId="auto-gradient-tile-ring"
                    className="pointer-events-none absolute -inset-0.5 rounded-[10px] ring-1 ring-primary/45"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                    }}
                  />
                ) : null}
              </button>
              {active && gradientConfig ? (
                <div className="absolute inset-0">
                  <GradientCustomizerPopover
                    ariaLabel="Customize auto gradient"
                    config={gradientConfig}
                    canReset={canResetGradient}
                    onAngleChange={setGradientAngle}
                    onColorChange={setGradientColor}
                    onReset={resetGradientEdits}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
