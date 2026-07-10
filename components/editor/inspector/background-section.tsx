"use client"

import * as React from "react"
import {
  RiDropLine,
  RiEraserLine,
  RiGradienterLine,
  RiImageLine,
  RiMagicLine,
} from "@remixicon/react"
import { toast } from "sonner"

import {
  downscaleImageFile,
  downscaleImageFromUrl,
  seedPlaceholderUrl,
} from "@/lib/editor/image-resize"
import { isUnsplashImageUrl } from "@/lib/editor/unsplash"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"
import {
  AUTO_PLACEHOLDER_GRADIENT,
  DEFAULT_IMAGE_BACKGROUND_ENTRY,
  GRADIENT_LIBRARY,
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  generateAutoGradients,
  sampleImageColorsRaw,
  useActiveCanvasField,
  useEditorStore,
  type BgType,
} from "@/lib/editor/store"

import { ColorPresetGrid } from "./primitives"
import { BgTabTrigger } from "./background-section-parts/bg-tab-trigger"
import {
  BACKGROUND_MAX_DIMENSION,
  buildLinearGradient,
  DEFAULT_LINEAR_GRADIENT,
  normalizeGradientColors,
  parseLinearGradient,
  withGradientOptions,
} from "./background-section-parts/constants"
import {
  AutoGradientPanel,
  GradientPanel,
} from "./background-section-parts/gradient-panels"
import { ImageBackgroundPanel } from "./background-section-parts/image-background-panel"

export function BackgroundSection({ flat = false }: { flat?: boolean } = {}) {
  const background = useActiveCanvasField((c) => c.background)
  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const setBackground = useEditorStore((s) => s.setBackground)
  const promotionIdRef = React.useRef(0)
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

  const autoGradients = React.useMemo(
    () =>
      autoResult && screenshot && autoResult.key === screenshot
        ? autoResult.gradients
        : [],
    [autoResult, screenshot]
  )
  const autoStatus: "idle" | "loading" | "ready" | "error" = !screenshot
    ? "idle"
    : !autoResult || autoResult.key !== screenshot
      ? "loading"
      : autoResult.error
        ? "error"
        : "ready"

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return
    const canvasId = useEditorStore.getState().present.activeCanvasId
    try {
      const dataUrl = await downscaleImageFile(file, {
        maxDimension: BACKGROUND_MAX_DIMENSION,
        maxRawBytes: 0,
        jpegQuality: 0.9,
      })
      setBackground({ type: "image", value: dataUrl }, canvasId)
    } catch {
      toast.error("Could not optimize that background image")
    }
  }

  const selectImageFromUrl = React.useCallback(
    (url: string, thumbUrl?: string) => {
      if (thumbUrl) seedPlaceholderUrl(url, thumbUrl)
      const canvasId = useEditorStore.getState().present.activeCanvasId
      const promotionId = ++promotionIdRef.current

      // Unsplash API guidelines require hotlinking `photo.urls.*` CDN URLs for
      // all live uses — never re-host or convert them to data URLs.
      if (isUnsplashImageUrl(url)) {
        setBackground(
          { type: "image", value: url, sourceUrl: url, thumbUrl },
          canvasId
        )
        return
      }

      // Show thumb immediately for snappy selection feedback.
      setBackground(
        { type: "image", value: thumbUrl ?? url, sourceUrl: url, thumbUrl },
        canvasId
      )

      if (url.startsWith("data:")) return

      // Downscale client-side (browser Canvas) to ~1600px JPEG.
      void downscaleImageFromUrl(url, {
        maxDimension: BACKGROUND_MAX_DIMENSION,
        jpegQuality: 0.9,
      })
        .then((downscaled) => {
          if (promotionIdRef.current !== promotionId) return
          const state = useEditorStore.getState()
          const canvas = state.present.canvases.find((c) => c.id === canvasId)
          const currentSource =
            canvas?.background.sourceUrl ?? canvas?.background.value
          if (canvas?.background.type !== "image" || currentSource !== url)
            return
          setBackground(
            { type: "image", value: downscaled, sourceUrl: url, thumbUrl },
            canvasId
          )
        })
        .catch((err) => {
          console.log("[bg] downscale failed, keeping thumb", err)
        })
    },
    [setBackground]
  )

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
    const offsets = GRADIENT_LIBRARY.reduce<number[]>((acc, category, idx) => {
      acc.push((acc[idx - 1] ?? 0) + category.items.length)
      return acc
    }, [])
    return GRADIENT_LIBRARY.map((category, idx) => {
      const start = idx === 0 ? 0 : offsets[idx - 1]
      const end = offsets[idx]
      return {
        key: category.key,
        label: category.label,
        options: gradientOptions.slice(start, end),
      }
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
          if (type === "none") {
            setBackground({ type, value: "" })
          } else if (type === "solid") {
            setBackground({
              type,
              value:
                background.type === "solid"
                  ? background.value
                  : SOLID_PRESETS[0],
            })
          } else if (type === "gradient") {
            setBackground({
              type,
              value:
                background.type === "gradient"
                  ? background.value
                  : GRADIENT_PRESETS[0],
            })
          } else if (type === "image") {
            if (background.type === "image") {
              setBackground(background)
            } else if (DEFAULT_IMAGE_BACKGROUND_ENTRY) {
              selectImageFromUrl(
                DEFAULT_IMAGE_BACKGROUND_ENTRY.full,
                DEFAULT_IMAGE_BACKGROUND_ENTRY.thumb
              )
            } else {
              setBackground({ type, value: "" })
            }
          } else if (type === "auto") {
            setBackground({
              type,
              value:
                background.type === "auto"
                  ? background.value
                  : (autoGradients[0] ?? AUTO_PLACEHOLDER_GRADIENT),
            })
          }
        }}
        className="w-full"
      >
        <div className="pt-1 pb-3">
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
        </div>

        <TabsContent value="image" className="mt-6 space-y-4">
          <ImageBackgroundPanel
            background={background}
            flat={flat}
            onUpload={onUpload}
            selectImageFromUrl={selectImageFromUrl}
          />
        </TabsContent>

        <TabsContent value="gradient" className="mt-6">
          <GradientPanel
            background={background}
            gradientCategoryOptions={gradientCategoryOptions}
            gradientCategoryKey={gradientCategoryKey}
            setGradientCategoryKey={setGradientCategoryKey}
            gradientExpanded={gradientExpanded}
            setGradientExpanded={setGradientExpanded}
            gradientConfig={gradientConfig}
            canResetGradient={canResetGradient}
            setGradientAngle={setGradientAngle}
            setGradientColor={setGradientColor}
            resetGradientEdits={resetGradientEdits}
            setBackground={setBackground}
          />
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
            tileShape="rect"
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
            <AutoGradientPanel
              background={background}
              autoGradientOptions={autoGradientOptions}
              gradientConfig={gradientConfig}
              canResetGradient={canResetGradient}
              setGradientAngle={setGradientAngle}
              setGradientColor={setGradientColor}
              resetGradientEdits={resetGradientEdits}
              setBackground={setBackground}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
