"use client"

import * as React from "react"
import debounce from "lodash/debounce"
import { AnimatePresence, motion } from "motion/react"
import InfiniteScroll from "react-infinite-scroll-component"
import {
  RiArrowRightLine,
  RiCloudLine,
  RiContrastLine,
  RiDropLine,
  RiEqualizerLine,
  RiEraserLine,
  RiFlashlightLine,
  RiFocus2Line,
  RiGradienterLine,
  RiGridLine,
  RiImageLine,
  RiLoader4Line,
  RiMacLine,
  RiMagicLine,
  RiMoonClearLine,
  RiRefreshLine,
  RiSearchLine,
  RiSunLine,
  RiUnsplashLine,
  RiUpload2Line,
} from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { EditableValue } from "@/components/editor/editable-value"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AUTO_PLACEHOLDER_GRADIENT,
  BACKGROUND_LIBRARY,
  DEFAULT_IMAGE_BACKGROUND,
  GRADIENT_LIBRARY,
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  generateAutoGradients,
  sampleImageColorsRaw,
  useActiveCanvasField,
  useEditorStore,
  type BackgroundEntry,
  type BgType,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import { ColorPresetGrid } from "./primitives"
import { ScrollFadeBody } from "../scroll-fade"

const BACKGROUND_PREVIEW_COUNT = 8
const GRADIENT_PREVIEW_COUNT = 8

const POP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const TILE_GRID_VARIANTS = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.025, delayChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12, ease: POP_EASE },
  },
}

const TILE_ITEM_VARIANTS = {
  initial: { opacity: 0, y: 8, scale: 0.96, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: POP_EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    filter: "blur(2px)",
    transition: { duration: 0.12, ease: POP_EASE },
  },
}

const DEFAULT_LINEAR_GRADIENT = {
  angle: 135,
  colors: ["#60a5fa", "#a78bfa", "#34d399", "#f472b6"],
}

const GRADIENT_COLOR_CONTROLS = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "accent", label: "Accent" },
  { id: "foreground", label: "Foreground" },
]

interface GradientOption {
  id: string
  baseValue: string
  value: string
}

type UnsplashResult = {
  id: string
  alt: string
  thumb: string
  full: string
  downloadLocation: string
  photographer: string
  photographerUrl: string
}

function parseLinearGradient(gradientValue: string): {
  angle: number
  colors: string[]
} | null {
  if (
    !gradientValue.startsWith("linear-gradient(") ||
    !gradientValue.endsWith(")")
  )
    return null
  const gradientBody = gradientValue.slice("linear-gradient(".length, -1)
  const parts = splitByTopLevelComma(gradientBody)
  if (parts.length < 3) return null
  const angleMatch = parts[0].trim().match(/(-?\d+(\.\d+)?)deg/)
  const angle = angleMatch
    ? Number.parseFloat(angleMatch[1])
    : DEFAULT_LINEAR_GRADIENT.angle
  const colors = parts
    .slice(1)
    .map((part) => part.trim().replace(/\s+\d+%$/g, ""))
    .filter(Boolean)
  if (colors.length < 2) return null
  return { angle, colors }
}

function splitByTopLevelComma(value: string): string[] {
  const parts: string[] = []
  let currentValue = ""
  let depth = 0
  for (const char of value) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      parts.push(currentValue)
      currentValue = ""
      continue
    }
    currentValue += char
  }
  if (currentValue.trim()) parts.push(currentValue)
  return parts
}

function normalizeGradientColors(
  colors: string[],
  targetLength: number
): string[] {
  const safeColors =
    colors.length > 0
      ? colors.slice(0, targetLength)
      : [...DEFAULT_LINEAR_GRADIENT.colors]
  while (safeColors.length < targetLength) {
    safeColors.push(
      safeColors[safeColors.length - 1] ?? DEFAULT_LINEAR_GRADIENT.colors[0]
    )
  }
  return safeColors
}

function buildLinearGradient({
  angle,
  colors,
}: {
  angle: number
  colors: string[]
}): string {
  return `linear-gradient(${Math.round(angle)}deg, ${colors.join(", ")})`
}

function withGradientOptions({
  values,
  valuePrefix,
  overrides,
}: {
  values: string[]
  valuePrefix: string
  overrides: Record<string, string>
}): GradientOption[] {
  return values.map((value, index) => {
    const id = `${valuePrefix}-${index}`
    return {
      id,
      baseValue: value,
      value: overrides[id] ?? value,
    }
  })
}

function gradientCategoryIcon(key: string) {
  switch (key) {
    case "warm":
      return RiSunLine
    case "cool":
      return RiMoonClearLine
    case "vivid":
      return RiFlashlightLine
    case "mono":
      return RiContrastLine
    case "pastel":
      return RiDropLine
    default:
      return RiGradienterLine
  }
}

function backgroundCategoryIcon(key: string) {
  switch (key) {
    case "mesh":
      return RiGridLine
    case "lines":
      return RiEqualizerLine
    case "gradient":
      return RiGradienterLine
    case "raycast":
      return RiFocus2Line
    case "mac":
      return RiMacLine
    case "cloud":
      return RiCloudLine
    default:
      return RiImageLine
  }
}

function BgTabTrigger({
  value,
  label,
  children,
}: {
  value: string
  label: string
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="group flex h-auto cursor-pointer flex-col items-center gap-2 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-active:!bg-transparent dark:data-active:!bg-transparent"
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150 group-data-[state=active]:bg-[#e8445a]/10">
        {children}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground transition-colors group-data-[state=active]:text-[#e8445a]">
        {label}
      </span>
    </TabsTrigger>
  )
}

function BackgroundTile({
  item,
  active,
  onClick,
  layoutId,
}: {
  item: BackgroundEntry
  active: boolean
  onClick: () => void
  layoutId: string
}) {
  return (
    <motion.div variants={TILE_ITEM_VARIANTS} className="relative">
      <button
        onClick={onClick}
        title={item.name}
        className={cn(
          "block aspect-video w-full cursor-pointer overflow-hidden rounded-lg border transition-colors",
          active ? "border-transparent" : "border-border/60 hover:border-foreground/30"
        )}
      >
        <img
          src={item.thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="pointer-events-none absolute -inset-0.5 rounded-[9px] ring-1 ring-primary/50"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}
    </motion.div>
  )
}

function BackgroundLibrary({
  activeUrl,
  onSelect,
}: {
  activeUrl: string | null
  onSelect: (value: string) => void
}) {
  const categories = BACKGROUND_LIBRARY
  const [activeKey, setActiveKey] = React.useState<string>(() => {
    const found = categories.find((c) =>
      c.items.some((item) => item.full === activeUrl)
    )
    return found?.key ?? categories[0]?.key ?? ""
  })
  const [expanded, setExpanded] = React.useState(false)

  const category = categories.find((c) => c.key === activeKey) ?? categories[0]

  if (!category) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
        No backgrounds available. Run <code>pnpm build:backgrounds</code>.
      </p>
    )
  }

  const items = category.items
  const visible = expanded ? items : items.slice(0, BACKGROUND_PREVIEW_COUNT)
  const hidden = items.slice(BACKGROUND_PREVIEW_COUNT)
  const peek = hidden[0] ?? null
  const showExpandTile = !expanded && hidden.length > 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary/40 p-1">
        {categories.map((c) => {
          const active = c.key === category.key
          const CategoryIcon = backgroundCategoryIcon(c.key)
          return (
            <button
              key={c.key}
              onClick={() => {
                setActiveKey(c.key)
                setExpanded(false)
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
                  layoutId="bg-category-pill"
                  className="absolute inset-0 rounded-[5px] bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
        transition={{ layout: { duration: 0.3, ease: POP_EASE } }}
        className="relative w-full"
      >
        {expanded ? (
          <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[280px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`bg-expanded-${category.key}`}
                variants={TILE_GRID_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="grid grid-cols-3 gap-2 px-1 py-1 pr-2"
              >
                {visible.map((item) => (
                  <BackgroundTile
                    key={item.id}
                    item={item}
                    active={activeUrl === item.full}
                    onClick={() => onSelect(item.full)}
                    layoutId={`bg-tile-ring-${category.key}`}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`bg-collapsed-${category.key}`}
              variants={TILE_GRID_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="grid grid-cols-3 gap-2 px-1 py-1"
            >
              {visible.map((item) => (
                <BackgroundTile
                  key={item.id}
                  item={item}
                  active={activeUrl === item.full}
                  onClick={() => onSelect(item.full)}
                  layoutId={`bg-tile-ring-${category.key}`}
                />
              ))}
              {showExpandTile ? (
                <motion.button
                  variants={TILE_ITEM_VARIANTS}
                  onClick={() => setExpanded(true)}
                  title={`Show all ${items.length} ${category.label.toLowerCase()} backgrounds`}
                  className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-border/60 transition-colors hover:border-foreground/30"
                >
                  {peek ? (
                    <img
                      src={peek.thumb}
                      alt=""
                      aria-hidden
                      className="h-full w-full scale-110 object-cover blur-sm"
                    />
                  ) : (
                    <div className="h-full w-full bg-secondary/40" />
                  )}
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
                    <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    <span className="text-[9px] font-semibold">
                      +{hidden.length}
                    </span>
                  </span>
                </motion.button>
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {expanded ? (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          onClick={() => setExpanded(false)}
          className="mt-2 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Show less
        </motion.button>
      ) : null}
    </div>
  )
}

function GradientCustomizerPopover({
  ariaLabel,
  config,
  canReset,
  onAngleChange,
  onColorChange,
  onReset,
}: {
  ariaLabel: string
  config: { angle: number; colors: string[] }
  canReset: boolean
  onAngleChange: (v: number) => void
  onColorChange: (idx: number, color: string) => void
  onReset: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={ariaLabel}
          className="absolute inset-0 z-10 m-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          <RiEqualizerLine className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[300px] space-y-4 border-border/60 bg-popover/95 p-3"
      >
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">Angle</span>
            <div className="flex items-center gap-2">
              <EditableValue
                value={Math.round(config.angle)}
                onChange={onAngleChange}
                min={0}
                max={360}
                suffix="deg"
              />
              <button
                aria-label="Reset gradient"
                disabled={!canReset}
                onClick={onReset}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/30 text-muted-foreground transition-colors",
                  canReset
                    ? "cursor-pointer hover:border-foreground/30 hover:text-foreground"
                    : "cursor-not-allowed opacity-40"
                )}
              >
                <RiRefreshLine className="size-3.5" />
              </button>
            </div>
          </div>
          <Slider
            value={[config.angle]}
            onValueChange={([value]) => onAngleChange(value)}
            min={0}
            max={360}
            className="cursor-pointer"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {GRADIENT_COLOR_CONTROLS.map(({ id, label }, colorIndex) => (
            <ColorPickerPopover
              key={id}
              value={config.colors[colorIndex]}
              onChange={(colorValue) => onColorChange(colorIndex, colorValue)}
            >
              <button className="flex h-10 cursor-pointer items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 text-left transition-colors hover:border-foreground/30">
                <span className="text-[11px] text-muted-foreground">
                  {label}
                </span>
                <span
                  className="size-5 rounded-full border border-border/60"
                  style={{ background: config.colors[colorIndex] }}
                />
              </button>
            </ColorPickerPopover>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function BackgroundSection() {
  const background = useActiveCanvasField((c) => c.background)
  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const setBackground = useEditorStore((s) => s.setBackground)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [unsplashQuery, setUnsplashQuery] = React.useState("")
  const [unsplashStatus, setUnsplashStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")
  const [unsplashError, setUnsplashError] = React.useState<string | null>(null)
  const [unsplashResults, setUnsplashResults] = React.useState<
    UnsplashResult[]
  >([])
  const [unsplashPage, setUnsplashPage] = React.useState(1)
  const [unsplashHasMore, setUnsplashHasMore] = React.useState(false)
  const [unsplashOpen, setUnsplashOpen] = React.useState(false)
  const [autoResult, setAutoResult] = React.useState<{
    key: string
    gradients: string[]
    error: boolean
  } | null>(null)

  React.useEffect(() => {
    if (!screenshot) return
    let cancelled = false
    sampleImageColorsRaw(screenshot, 6)
      .then((colors) => {
        if (cancelled) return
        const gradients = generateAutoGradients(colors, 100)
        setAutoResult({
          key: screenshot,
          gradients,
          error: gradients.length === 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setAutoResult({ key: screenshot, gradients: [], error: true })
      })
    return () => {
      cancelled = true
    }
  }, [screenshot])

  const autoGradients =
    autoResult && screenshot && autoResult.key === screenshot
      ? autoResult.gradients
      : []
  const autoStatus: "idle" | "loading" | "ready" | "error" = !screenshot
    ? "idle"
    : !autoResult || autoResult.key !== screenshot
      ? "loading"
      : autoResult.error
        ? "error"
        : "ready"

  const onUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBackground({ type: "image", value: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  const searchUnsplash = React.useCallback(
    async (overrideQuery?: string, page = 1) => {
      const query = (overrideQuery ?? unsplashQuery).trim()
      if (!query) return

      setUnsplashStatus("loading")
      setUnsplashError(null)
      try {
        const response = await fetch(
          `/api/unsplash/search?q=${encodeURIComponent(query)}&page=${page}`
        )
        const data = (await response.json()) as
          | { results: UnsplashResult[]; hasMore?: boolean; page?: number }
          | { error?: string }

        if (!response.ok || !("results" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to search Unsplash"
          )
        }

        setUnsplashResults((prev) =>
          page === 1 ? data.results : [...prev, ...data.results]
        )
        setUnsplashPage(page)
        setUnsplashHasMore(Boolean(data.hasMore))
        setUnsplashStatus("ready")
        setUnsplashOpen(true)
      } catch (error) {
        setUnsplashStatus("error")
        setUnsplashHasMore(false)
        setUnsplashError(
          error instanceof Error ? error.message : "Unable to search Unsplash"
        )
      }
    },
    [unsplashQuery]
  )

  const debouncedSearchUnsplash = React.useMemo(
    () =>
      debounce((query: string) => {
        void searchUnsplash(query, 1)
      }, 200),
    [searchUnsplash]
  )

  React.useEffect(
    () => () => debouncedSearchUnsplash.cancel(),
    [debouncedSearchUnsplash]
  )

  const loadMoreUnsplash = () => {
    if (
      unsplashStatus === "loading" ||
      unsplashStatus === "error" ||
      !unsplashHasMore
    )
      return
    void searchUnsplash(undefined, unsplashPage + 1)
  }

  const selectUnsplashImage = (photo: UnsplashResult) => {
    setBackground({ type: "image", value: photo.full })
    void fetch(
      `/api/unsplash/download?url=${encodeURIComponent(photo.downloadLocation)}`
    )
  }

  const customSolid =
    background.type === "solid" && !SOLID_PRESETS.includes(background.value)
      ? background.value
      : null
  const [gradientOverrides, setGradientOverrides] = React.useState<
    Record<string, string>
  >({})
  const [autoGradientOverrides, setAutoGradientOverrides] = React.useState<
    Record<string, string>
  >({})
  const gradientOptions = React.useMemo(
    () =>
      withGradientOptions({
        values: GRADIENT_PRESETS,
        valuePrefix: "preset",
        overrides: gradientOverrides,
      }),
    [gradientOverrides]
  )
  const gradientCategoryOptions = React.useMemo(() => {
    let cursor = 0
    return GRADIENT_LIBRARY.map((category) => {
      const slice = gradientOptions.slice(
        cursor,
        cursor + category.items.length
      )
      cursor += category.items.length
      return { key: category.key, label: category.label, options: slice }
    })
  }, [gradientOptions])
  const [gradientCategoryKey, setGradientCategoryKey] = React.useState<string>(
    () => {
      if (background.type === "gradient") {
        const found = GRADIENT_LIBRARY.find((c) =>
          c.items.includes(background.value)
        )
        if (found) return found.key
      }
      return GRADIENT_LIBRARY[0]?.key ?? "warm"
    }
  )
  const [gradientExpanded, setGradientExpanded] = React.useState(false)
  const autoGradientOptions = React.useMemo(
    () =>
      withGradientOptions({
        values: autoGradients,
        valuePrefix: "auto",
        overrides: autoGradientOverrides,
      }),
    [autoGradients, autoGradientOverrides]
  )
  const activeGradientOption = React.useMemo(
    () =>
      background.type === "gradient"
        ? (gradientOptions.find(
            (option) => option.value === background.value
          ) ?? null)
        : null,
    [background, gradientOptions]
  )
  const activeAutoGradientOption = React.useMemo(
    () =>
      background.type === "auto"
        ? (autoGradientOptions.find(
            (option) => option.value === background.value
          ) ?? null)
        : null,
    [background, autoGradientOptions]
  )
  const gradientConfig = React.useMemo(() => {
    if (background.type !== "gradient" && background.type !== "auto")
      return null
    const parsedGradient = parseLinearGradient(background.value)
    if (!parsedGradient) return null
    return {
      angle: parsedGradient.angle,
      colors: normalizeGradientColors(parsedGradient.colors, 4),
    }
  }, [background])

  const setGradientAngle = (angle: number) => {
    if (background.type !== "gradient" && background.type !== "auto") return
    const parsedGradient =
      parseLinearGradient(background.value) ?? DEFAULT_LINEAR_GRADIENT
    const normalizedColors = normalizeGradientColors(parsedGradient.colors, 4)
    const nextGradient = buildLinearGradient({
      angle,
      colors: normalizedColors,
    })
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => ({
        ...prev,
        [activeGradientOption.id]: nextGradient,
      }))
      setBackground({ type: "gradient", value: nextGradient })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => ({
      ...prev,
      [activeAutoGradientOption.id]: nextGradient,
    }))
    setBackground({ type: "auto", value: nextGradient })
  }

  const setGradientColor = (colorIndex: number, colorValue: string) => {
    if (background.type !== "gradient" && background.type !== "auto") return
    const parsedGradient =
      parseLinearGradient(background.value) ?? DEFAULT_LINEAR_GRADIENT
    const normalizedColors = normalizeGradientColors(parsedGradient.colors, 4)
    if (colorIndex < 0 || colorIndex >= normalizedColors.length) return
    normalizedColors[colorIndex] = colorValue
    const nextGradient = buildLinearGradient({
      angle: parsedGradient.angle,
      colors: normalizedColors,
    })
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => ({
        ...prev,
        [activeGradientOption.id]: nextGradient,
      }))
      setBackground({ type: "gradient", value: nextGradient })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => ({
      ...prev,
      [activeAutoGradientOption.id]: nextGradient,
    }))
    setBackground({ type: "auto", value: nextGradient })
  }
  const resetGradientEdits = () => {
    if (background.type !== "gradient" && background.type !== "auto") return
    if (background.type === "gradient") {
      if (!activeGradientOption) return
      setGradientOverrides((prev) => {
        const next = { ...prev }
        delete next[activeGradientOption.id]
        return next
      })
      setBackground({ type: "gradient", value: activeGradientOption.baseValue })
      return
    }
    if (!activeAutoGradientOption) return
    setAutoGradientOverrides((prev) => {
      const next = { ...prev }
      delete next[activeAutoGradientOption.id]
      return next
    })
    setBackground({ type: "auto", value: activeAutoGradientOption.baseValue })
  }
  const canResetGradient =
    background.type === "gradient"
      ? !!(
          activeGradientOption &&
          activeGradientOption.value !== activeGradientOption.baseValue
        )
      : !!(
          activeAutoGradientOption &&
          activeAutoGradientOption.value !== activeAutoGradientOption.baseValue
        )

  return (
    <div className="flex flex-col gap-6 pt-3">
      <Tabs
        value={background.type}
        onValueChange={(v) => {
          const type = v as BgType
          if (type === "none") setBackground({ type, value: "" })
          else if (type === "solid")
            setBackground({
              type,
              value:
                background.type === "solid"
                  ? background.value
                  : SOLID_PRESETS[0],
            })
          else if (type === "gradient")
            setBackground({
              type,
              value:
                background.type === "gradient"
                  ? background.value
                  : GRADIENT_PRESETS[0],
            })
          else if (type === "image")
            setBackground({
              type,
              value:
                background.type === "image"
                  ? background.value
                  : DEFAULT_IMAGE_BACKGROUND,
            })
          else if (type === "auto")
            setBackground({
              type,
              value:
                background.type === "auto"
                  ? background.value
                  : (autoGradients[0] ?? AUTO_PLACEHOLDER_GRADIENT),
            })
        }}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-between bg-transparent p-0">
          <BgTabTrigger value="none" label="None">
            <RiEraserLine className="size-4 text-muted-foreground group-data-[state=active]:text-[#e8445a]" />
          </BgTabTrigger>
          <BgTabTrigger value="auto" label="Auto">
            <RiMagicLine className="size-4 text-muted-foreground group-data-[state=active]:text-[#e8445a]" />
          </BgTabTrigger>
          <BgTabTrigger value="solid" label="Solid">
            <RiDropLine className="size-4 text-muted-foreground group-data-[state=active]:text-[#e8445a]" />
          </BgTabTrigger>
          <BgTabTrigger value="gradient" label="Gradient">
            <RiGradienterLine className="size-4 text-muted-foreground group-data-[state=active]:text-[#e8445a]" />
          </BgTabTrigger>
          <BgTabTrigger value="image" label="Image">
            <RiImageLine className="size-4 text-muted-foreground group-data-[state=active]:text-[#e8445a]" />
          </BgTabTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-6 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ""
            }}
          />
          <div className="flex gap-2">
            <Popover open={unsplashOpen} onOpenChange={setUnsplashOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 flex-1 cursor-pointer gap-2 bg-[#9BCD64] text-[#10220e] hover:bg-[#8ec25a]"
                >
                  <RiUnsplashLine className="size-4" />
                  <span className="text-[11px] font-medium">Unsplash</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="left"
                align="start"
                sideOffset={10}
                className="w-[320px] space-y-1.5 border-border/60 bg-popover/95 p-3 backdrop-blur-md"
              >
                <div>
                  <p className="text-[12px] font-medium">Search Unsplash</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Pick a landscape photo as the canvas background.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      value={unsplashQuery}
                      onChange={(e) => {
                        const next = e.target.value
                        setUnsplashQuery(next)
                        debouncedSearchUnsplash(next)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void searchUnsplash()
                      }}
                      placeholder="Search backgrounds"
                      className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-secondary/30 px-3 text-[12px] transition-colors outline-none placeholder:text-muted-foreground focus:border-[#9BCD64]/70"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      onClick={() => searchUnsplash()}
                      disabled={unsplashStatus === "loading"}
                    >
                      {unsplashStatus === "loading" ? (
                        <RiLoader4Line className="size-4 animate-spin" />
                      ) : (
                        <RiSearchLine className="size-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Abstract", "Minimal", "Nature", "Gradient", "Space"].map(
                      (q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setUnsplashQuery(q)
                            void searchUnsplash(q, 1)
                          }}
                          className={cn(
                            "cursor-pointer rounded-md border border-border/60 bg-secondary/30 px-2 py-1 text-[10px] font-medium transition-all hover:border-[#9BCD64]/40 hover:bg-[#9BCD64]/10 hover:text-foreground",
                            unsplashQuery === q &&
                              "border-[#9BCD64]/50 bg-[#9BCD64]/10 text-[#9BCD64] ring-1 ring-[#9BCD64]/20"
                          )}
                        >
                          {q}
                        </button>
                      )
                    )}
                  </div>
                  {unsplashStatus === "error" ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                      {unsplashError}
                    </p>
                  ) : null}
                  <ScrollFadeBody
                    id="unsplash-results-scroll"
                    rootClassName="h-[300px] max-h-[300px]"
                    className="p-2"
                  >
                    {unsplashResults.length > 0 ? (
                      <InfiniteScroll
                        dataLength={unsplashResults.length}
                        next={loadMoreUnsplash}
                        hasMore={unsplashHasMore}
                        loader={
                          <div className="col-span-3 flex justify-center py-2 text-muted-foreground">
                            <RiLoader4Line className="size-4 animate-spin" />
                          </div>
                        }
                        scrollableTarget="unsplash-results-scroll"
                        className="grid w-full grid-cols-3 gap-2.5"
                      >
                        {unsplashResults.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => selectUnsplashImage(photo)}
                            title={`Photo by ${photo.photographer}`}
                            className={cn(
                              "relative aspect-video cursor-pointer overflow-hidden rounded-lg border transition-colors",
                              background.type === "image" &&
                                background.value === photo.full
                                ? "border-primary/80 ring-2 ring-primary/60 ring-inset"
                                : "border-border/60 hover:border-foreground/30"
                            )}
                          >
                            <img
                              src={photo.thumb}
                              alt={photo.alt}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </InfiniteScroll>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <p className="text-[11px]">
                          Select a topic or search to load photos.
                        </p>
                      </div>
                    )}
                  </ScrollFadeBody>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="default"
              size="sm"
              className="h-9 flex-1 cursor-pointer gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <RiUpload2Line className="size-4" />
              <span className="text-[11px] font-medium">Upload</span>
            </Button>
          </div>

          <BackgroundLibrary
            activeUrl={background.type === "image" ? background.value : null}
            onSelect={(value) => setBackground({ type: "image", value })}
          />
        </TabsContent>

        <TabsContent value="gradient" className="mt-6">
          {(() => {
            const activeCategory =
              gradientCategoryOptions.find(
                (c) => c.key === gradientCategoryKey
              ) ?? gradientCategoryOptions[0]
            if (!activeCategory) return null
            const items = activeCategory.options
            const visible = gradientExpanded
              ? items
              : items.slice(0, GRADIENT_PREVIEW_COUNT)
            const hidden = items.slice(GRADIENT_PREVIEW_COUNT)
            const peek = hidden[0] ?? null
            const showExpandTile = !gradientExpanded && hidden.length > 0
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
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
                  transition={{ layout: { duration: 0.3, ease: POP_EASE } }}
                  className="relative w-full"
                >
                  {gradientExpanded ? (
                    <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[280px]">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`grad-expanded-${activeCategory.key}`}
                          variants={TILE_GRID_VARIANTS}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="grid grid-cols-3 gap-2 px-1 py-1 pr-2"
                        >
                          {visible.map((option) => {
                            const active =
                              background.type === "gradient" &&
                              background.value === option.value
                            return (
                              <motion.div key={option.id} variants={TILE_ITEM_VARIANTS} className="relative">
                              <button
                                onClick={() =>
                                  setBackground({
                                    type: "gradient",
                                    value: option.value,
                                  })
                                }
                                className={cn(
                                  "aspect-video w-full cursor-pointer overflow-hidden rounded-xl border",
                                  active ? "border-transparent" : "border-border/60"
                                )}
                              >
                                <span
                                  className="block size-full rounded-[inherit]"
                                  style={{ background: option.value }}
                                />
                              </button>
                              {active ? (
                                <motion.span
                                  layoutId={`gradient-tile-ring-${activeCategory.key}`}
                                  className="pointer-events-none absolute -inset-0.5 rounded-[13px] ring-1 ring-primary/45"
                                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                                />
                              ) : null}
                                {active && gradientConfig ? (
                                  <GradientCustomizerPopover
                                    ariaLabel="Customize gradient"
                                    config={gradientConfig}
                                    canReset={canResetGradient}
                                    onAngleChange={setGradientAngle}
                                    onColorChange={setGradientColor}
                                    onReset={resetGradientEdits}
                                  />
                                ) : null}
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      </AnimatePresence>
                    </ScrollArea>
                  ) : (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`grad-collapsed-${activeCategory.key}`}
                        variants={TILE_GRID_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="grid grid-cols-3 gap-2 px-1 py-1"
                      >
                        {visible.map((option) => {
                          const active =
                            background.type === "gradient" &&
                            background.value === option.value
                          return (
                            <motion.div key={option.id} variants={TILE_ITEM_VARIANTS} className="relative">
                            <button
                              onClick={() =>
                                setBackground({
                                  type: "gradient",
                                  value: option.value,
                                })
                              }
                              className={cn(
                                "aspect-video w-full cursor-pointer overflow-hidden rounded-xl border",
                                active ? "border-transparent" : "border-border/60"
                              )}
                            >
                              <span
                                className="block size-full rounded-[inherit]"
                                style={{ background: option.value }}
                              />
                            </button>
                            {active ? (
                              <motion.span
                                layoutId={`gradient-tile-ring-${activeCategory.key}`}
                                className="pointer-events-none absolute -inset-0.5 rounded-[13px] ring-1 ring-primary/45"
                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              />
                            ) : null}
                              {active && gradientConfig ? (
                                <GradientCustomizerPopover
                                  ariaLabel="Customize gradient"
                                  config={gradientConfig}
                                  canReset={canResetGradient}
                                  onAngleChange={setGradientAngle}
                                  onColorChange={setGradientColor}
                                  onReset={resetGradientEdits}
                                />
                              ) : null}
                            </motion.div>
                          )
                        })}
                        {showExpandTile ? (
                          <motion.button
                            variants={TILE_ITEM_VARIANTS}
                            onClick={() => setGradientExpanded(true)}
                            title={`Show all ${items.length} ${activeCategory.label.toLowerCase()} gradients`}
                            className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-border/60 transition-colors hover:border-foreground/30"
                          >
                            {peek ? (
                              <span
                                className="block size-full scale-110 blur-sm"
                                style={{ background: peek.value }}
                              />
                            ) : (
                              <span className="block size-full bg-secondary/40" />
                            )}
                            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
                              <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                              <span className="text-[9px] font-semibold">
                                +{hidden.length}
                              </span>
                            </span>
                          </motion.button>
                        ) : null}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </motion.div>

                {gradientExpanded ? (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                    onClick={() => setGradientExpanded(false)}
                    className="mt-2 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Show less
                  </motion.button>
                ) : null}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="solid" className="mt-6">
          <ColorPresetGrid
            presets={SOLID_PRESETS}
            selected={
              background.type === "solid" && !customSolid
                ? background.value
                : null
            }
            onSelect={(c) => setBackground({ type: "solid", value: c })}
            customColor={customSolid || "#000000"}
            onCustomColor={(hex) =>
              setBackground({ type: "solid", value: hex })
            }
            isCustom={!!customSolid}
          />
        </TabsContent>

        <TabsContent value="none" className="mt-6">
          <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
            Transparent background
          </p>
        </TabsContent>

        <TabsContent value="auto" className="mt-6">
          {!screenshot ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Drop a screenshot to generate matching gradients
            </p>
          ) : autoStatus === "loading" ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Sampling colours from your screenshot…
            </p>
          ) : autoStatus === "error" || autoGradients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Couldn&apos;t read colours from this image
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 px-1 py-1">
              {autoGradientOptions.map((option) => {
                const active =
                  background.type === "auto" &&
                  background.value === option.value
                return (
                  <div key={option.id} className="relative">
                    <button
                      onClick={() =>
                        setBackground({ type: "auto", value: option.value })
                      }
                      className={cn(
                        "aspect-video w-full cursor-pointer overflow-hidden rounded-xl border",
                        active ? "border-transparent" : "border-border/60"
                      )}
                    >
                      <span
                        className="block size-full rounded-[inherit]"
                        style={{ background: option.value }}
                      />
                    </button>
                    {active ? (
                      <motion.span
                        layoutId="auto-gradient-tile-ring"
                        className="pointer-events-none absolute -inset-0.5 rounded-[13px] ring-1 ring-primary/45"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    {active && gradientConfig ? (
                      <GradientCustomizerPopover
                        ariaLabel="Customize auto gradient"
                        config={gradientConfig}
                        canReset={canResetGradient}
                        onAngleChange={setGradientAngle}
                        onColorChange={setGradientColor}
                        onReset={resetGradientEdits}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
