"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiLayoutGrid2Line,
  RiPaletteLine,
  RiRotateLockLine,
  RiUpload2Line,
  RiImageLine,
  RiGradienterLine,
  RiSunLine,
  RiEqualizerLine,
  RiGridLine,
  RiFocus2Line,
  RiArrowGoBackLine,
  RiUnsplashLine,
  RiMoonClearLine,
  RiArrowLeftUpLine,
  RiArrowUpLine,
  RiArrowRightUpLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiArrowLeftDownLine,
  RiArrowDownLine,
  RiArrowRightDownLine,
  RiFocus3Line,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function Inspector() {
  return (
    <aside className="flex h-full min-h-0 w-[308px] shrink-0 flex-col border-l border-border/60 bg-sidebar overflow-hidden">
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

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3 pb-24">
          <Section icon={RiSunLine} title="Backdrop" defaultOpen>
            <BackdropSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

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
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiMoonClearLine} title="Shadow" defaultOpen>
            <ShadowSection />
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
        className="flex w-full items-center gap-2 py-1.5 text-left cursor-pointer"
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.18 }}
          className="inline-flex size-4 items-center justify-center text-muted-foreground"
        >
          <RiArrowDownSLine className="size-4" />
        </motion.span>
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
            <div className="pt-2 pb-1 pl-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SubHeader({
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

/* -------- Backdrop -------- */

function BackdropSection() {
  const [overlayOpacity, setOverlayOpacity] = React.useState(10)
  const [overlayPosition, setOverlayPosition] = React.useState("overlay")
  const [effectsEnabled, setEffectsEnabled] = React.useState(true)
  const [noise, setNoise] = React.useState(10)
  const [blur, setBlur] = React.useState(0)
  const [saturation, setSaturation] = React.useState(100)
  const [opacity, setOpacity] = React.useState(100)
  const [selectedPatterns, setSelectedPatterns] = React.useState<number[]>([1])
  const [patternIntensity, setPatternIntensity] = React.useState(50)
  const [patternThickness, setPatternThickness] = React.useState(1)
  const [patternColor, setPatternColor] = React.useState("#8E51FF")

  const patterns = [
    { id: 1, name: "Dots", cls: "bg-background [background-image:radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.2)_1px,_transparent_1px)] [background-size:8px_8px]" },
    { id: 2, name: "Grid", cls: "bg-background [background-image:linear-gradient(oklch(from_var(--foreground)_l_c_h_/_0.15)_1px,_transparent_1px),linear-gradient(90deg,oklch(from_var(--foreground)_l_c_h_/_0.15)_1px,_transparent_1px)] [background-size:10px_10px]" },
    { id: 3, name: "Diagonals", cls: "bg-background [background-image:repeating-linear-gradient(-45deg,oklch(from_var(--foreground)_l_c_h_/_0.12)_0_1px,transparent_1px_6px)]" },
    { id: 4, name: "Noise", cls: "bg-background [background-image:radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.08)_1px,transparent_1px),radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.05)_1px,transparent_1px)] [background-size:7px_7px,11px_11px] [background-position:0_0,3px_3px]" },
    { id: 5, name: "Mesh", cls: "bg-[conic-gradient(at_top_left,var(--tw-gradient-stops))] from-indigo-200 via-slate-600 to-indigo-200" },
    { id: 6, name: "Waves", cls: "bg-background [background-image:linear-gradient(30deg,#4466ff_12%,transparent_12.5%,transparent_87%,#4466ff_87.5%,#4466ff),linear-gradient(150deg,#4466ff_12%,transparent_12.5%,transparent_87%,#4466ff_87.5%,#4466ff),linear-gradient(30deg,#4466ff_12%,transparent_12.5%,transparent_87%,#4466ff_87.5%,#4466ff),linear-gradient(150deg,#4466ff_12%,transparent_12.5%,transparent_87%,#4466ff_87.5%,#4466ff),linear-gradient(60deg,#4466ff77_25%,transparent_25.5%,transparent_75%,#4466ff77_75%,#4466ff77),linear-gradient(60deg,#4466ff77_25%,transparent_25.5%,transparent_75%,#4466ff77_75%,#4466ff77)] [background-size:80px_140px]" },
  ]

  const shadowPatterns = [
    { id: 0, cls: "bg-checker" },
    { id: 1, cls: "bg-gradient-to-br from-white/0 via-black/20 to-black/40" },
    { id: 2, cls: "bg-gradient-to-r from-black/20 via-transparent to-black/20" },
    { id: 3, cls: "bg-[radial-gradient(circle,transparent_20%,black_100%)]" },
    { id: 4, cls: "bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px]" },
    { id: 5, cls: "bg-gradient-to-t from-black/30 to-transparent" },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="default" size="sm" className="h-9 justify-start gap-2 px-3 font-medium cursor-pointer">
            <RiSunLine className="size-4" />
            <span>Overlay</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-[240px] space-y-4 bg-popover/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Shadow Overlay</span>
            <Button variant="ghost" size="icon" className="size-6 cursor-pointer">
              <RiArrowGoBackLine className="size-3" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {shadowPatterns.map((p) => (
              <button key={p.id} className={cn("aspect-square rounded-md border border-border/60 cursor-pointer", p.cls)} />
            ))}
          </div>
          <Button variant="secondary" size="sm" className="w-full text-[11px] h-8 cursor-pointer">
            <RiArrowDownSLine className="mr-1 size-3" />
            Show More
          </Button>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground">Opacity</span>
              <span className="tabular font-mono text-[11px] text-foreground/80">{overlayOpacity}%</span>
            </div>
            <Slider value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} max={100} className="cursor-pointer" />
            <div className="space-y-2">
              <span className="text-[11px] text-muted-foreground">Position</span>
              <ToggleGroup type="single" value={overlayPosition} onValueChange={(v) => v && setOverlayPosition(v)} className="flex w-full bg-secondary/40 p-1">
                <ToggleGroupItem value="overlay" className="flex-1 h-7 text-[10px] cursor-pointer">Overlay</ToggleGroupItem>
                <ToggleGroupItem value="underlay" className="flex-1 h-7 text-[10px] cursor-pointer">Underlay</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="default" size="sm" className="h-9 justify-start gap-2 px-3 font-medium cursor-pointer">
            <RiEqualizerLine className="size-4" />
            <span>Effects</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-[240px] space-y-4 bg-popover/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Effects</span>
            <Switch size="sm" checked={effectsEnabled} onCheckedChange={setEffectsEnabled} className="cursor-pointer" />
          </div>
          <div className="space-y-4">
            <EffectSlider label="Noise" value={noise} onChange={setNoise} />
            <EffectSlider label="Blur" value={blur} onChange={setBlur} max={20} />
            <EffectSlider label="Saturation" value={saturation} onChange={setSaturation} max={200} />
            <EffectSlider label="Opacity" value={opacity} onChange={setOpacity} />
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="default" size="sm" className="h-9 justify-start gap-2 px-3 font-medium cursor-pointer">
            <RiGridLine className="size-4" />
            <span>Pattern</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-[240px] space-y-4 bg-popover/95 backdrop-blur-md">
           <span className="text-[13px] font-medium">Patterns</span>
           <div className="grid grid-cols-3 gap-2">
            {patterns.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPatterns(prev => 
                    prev.includes(p.id) ? prev.filter(v => v !== p.id) : [...prev, p.id]
                  )
                }}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border transition-all cursor-pointer",
                  selectedPatterns.includes(p.id)
                    ? "border-foreground ring-1 ring-foreground/20"
                    : "border-border/60 hover:border-foreground/30",
                  p.cls
                )}
              />
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Intensity</span>
                <span className="tabular font-mono text-[11px] text-foreground/80">{patternIntensity}%</span>
              </div>
              <Slider value={[patternIntensity]} onValueChange={([v]) => setPatternIntensity(v)} max={100} className="cursor-pointer" />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Thickness</span>
                <span className="tabular font-mono text-[11px] text-foreground/80">{patternThickness}px</span>
              </div>
              <Slider value={[patternThickness]} onValueChange={([v]) => setPatternThickness(v)} min={1} max={10} step={0.5} className="cursor-pointer" />
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block mb-2">Colour</span>
              <div className="flex flex-wrap gap-1.5">
                {["#8E51FF", "#000000", "#FFFFFF", "#F87171", "#34D399", "#60A5FA"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPatternColor(c)}
                    className={cn(
                      "size-5 rounded-full border border-border/60 cursor-pointer transition-transform hover:scale-110",
                      patternColor === c && "ring-2 ring-primary ring-offset-1 ring-offset-popover"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="default" size="sm" className="h-9 justify-start gap-2 px-3 font-medium cursor-pointer">
        <RiFocus2Line className="size-4" />
        <span>Portrait</span>
      </Button>
    </div>
  )
}

/* -------- Background -------- */

function BackgroundSection() {
  const [bgType, setBgType] = React.useState("image")
  const [borderRadius, setBorderRadius] = React.useState(12)

  const preMadeImages = [
    { name: "Raycast", src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop" },
    { name: "Dark Gradient", src: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=200&auto=format&fit=crop" },
    { name: "Texture", src: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=200&auto=format&fit=crop" },
    { name: "Abstract", src: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=200&auto=format&fit=crop" },
    { name: "Flow", src: "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=200&auto=format&fit=crop" },
    { name: "Noise", src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop" },
    { name: "Mesh", src: "https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=200&auto=format&fit=crop" },
    { name: "Linear", src: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=200&auto=format&fit=crop" },
    { name: "Soft", src: "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?q=80&w=200&auto=format&fit=crop" },
  ]

  return (
    <div className="flex flex-col gap-6 pt-3">
      <Tabs value={bgType} onValueChange={setBgType} className="w-full">
        <TabsList className="flex h-auto w-full justify-between bg-transparent p-0">
          <CircularTabTrigger value="none" label="None">
            <div className="size-full bg-checker" />
          </CircularTabTrigger>
          <CircularTabTrigger value="solid" label="Solid">
            <div className="size-full bg-white" />
          </CircularTabTrigger>
          <CircularTabTrigger value="gradient" label="Gradient">
            <div className="size-full bg-gradient-to-br from-primary/60 to-primary" />
          </CircularTabTrigger>
          <CircularTabTrigger value="image" label="Image">
            <RiImageLine className="size-4 text-white group-data-[state=active]:text-white" />
          </CircularTabTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="h-9 flex-1 gap-2 cursor-pointer">
              <RiUnsplashLine className="size-4" />
              <span className="text-[11px] font-medium">Unsplash</span>
            </Button>
            <Button variant="default" size="sm" className="h-9 flex-1 gap-2 cursor-pointer">
              <RiUpload2Line className="size-4" />
              <span className="text-[11px] font-medium">Upload</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {preMadeImages.map((img, i) => (
              <button key={i} className="group flex flex-col gap-1.5 text-left cursor-pointer">
                <div className="aspect-square overflow-hidden rounded-lg border border-border/60 transition-all group-hover:border-foreground/40">
                  <img src={img.src} alt={img.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                </div>
                <span className="truncate text-[9px] font-medium text-muted-foreground group-hover:text-foreground">
                  {img.name}
                </span>
              </button>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="gradient" className="mt-6">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <button key={i} className="aspect-square rounded-md border border-border/60 bg-gradient-to-br from-indigo-500 to-purple-500 transition-transform hover:-translate-y-0.5 cursor-pointer" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="solid" className="mt-6">
           <div className="grid grid-cols-6 gap-2">
            {["#000000", "#ffffff", "#f87171", "#fbbf24", "#34d399", "#60a5fa"].map((c) => (
              <button key={c} className="aspect-square rounded-md border border-border/60 transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: c }} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="my-1 h-px bg-border/40" />

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Radius</span>
          <span className="tabular font-mono text-[11px] text-foreground/80">{borderRadius}px</span>
        </div>
        <Slider value={[borderRadius]} onValueChange={([v]) => setBorderRadius(v)} max={48} className="cursor-pointer" />
      </div>
    </div>
  )
}

function CircularTabTrigger({ value, label, children }: { value: string, label: string, children: React.ReactNode }) {
  return (
    <TabsTrigger 
      value={value} 
      className="group flex h-auto flex-col items-center gap-1.5 bg-transparent p-0 data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:!border-none cursor-pointer"
    >
      <div className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 transition-all group-hover:border-primary/40 group-data-[state=active]:border-transparent",
        value === "image" && "group-data-[state=active]:bg-primary"
      )}>
        {children}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground group-data-[state=active]:text-foreground">
        {label}
      </span>
    </TabsTrigger>
  )
}

function EffectSlider({ label, value, onChange, max = 100 }: { label: string, value: number, onChange: (v: number) => void, max?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="tabular font-mono text-[11px] text-foreground/80">{value}{max === 100 ? "%" : ""}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} max={max} className="cursor-pointer" />
    </div>
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
        className="mb-3 cursor-pointer"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setInset(q)}
            className={cn(
              "tabular h-8 rounded-md border font-mono text-[11px] transition-colors cursor-pointer",
              inset === q
                ? "border-primary/30 bg-primary text-white"
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
        className="cursor-pointer"
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
        className="cursor-pointer"
      />
    </div>
  )
}

/* -------- Shadow -------- */

function ShadowSection() {
  const [type, setType] = React.useState("spread")
  const [intensity, setIntensity] = React.useState(40)
  const [lightSource, setLightSource] = React.useState("top-left")

  const types = [
    { id: "none", label: "None", icon: (
      <div className="size-full rounded-sm bg-background p-1.5">
         <div className="size-full rounded-sm border-2 border-dashed border-border" />
      </div>
    )},
    { id: "spread", label: "Spread", icon: (
      <div className="size-full rounded-sm bg-background p-1.5 shadow-[4px_4px_8px_-2px_rgba(0,0,0,0.2)]">
        <div className="size-full rounded-sm bg-white border border-border/20" />
      </div>
    )},
    { id: "hug", label: "Hug", icon: (
      <div className="size-full rounded-sm bg-background p-1.5 shadow-[0_0_12px_-2px_rgba(0,0,0,0.3)]">
        <div className="size-full rounded-sm bg-white border border-border/20" />
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all cursor-pointer",
              type === t.id 
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" 
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div className="aspect-square w-full">
              {t.icon}
            </div>
            <span className={cn(
              "text-[9px] font-medium",
              type === t.id ? "text-primary" : "text-muted-foreground"
            )}>{t.label}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Intensity</span>
          <span className="tabular font-mono text-[11px] text-foreground/80">{intensity}%</span>
        </div>
        <Slider value={[intensity]} onValueChange={([v]) => setIntensity(v)} max={100} className="cursor-pointer" />
      </div>

      <div>
        <SubHeader>Light Source</SubHeader>
        <div className="grid grid-cols-3 gap-1.5 w-full mt-2">
          {LIGHT_POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setLightSource(pos.id)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border transition-all cursor-pointer",
                lightSource === pos.id
                  ? "border-primary bg-primary text-white"
                  : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30"
              )}
            >
              {pos.icon && <pos.icon className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const LIGHT_POSITIONS = [
  { id: "top-left", icon: RiArrowLeftUpLine },
  { id: "top", icon: RiArrowUpLine },
  { id: "top-right", icon: RiArrowRightUpLine },
  { id: "left", icon: RiArrowLeftLine },
  { id: "center", icon: RiFocus3Line },
  { id: "right", icon: RiArrowRightLine },
  { id: "bottom-left", icon: RiArrowLeftDownLine },
  { id: "bottom", icon: RiArrowDownLine },
  { id: "bottom-right", icon: RiArrowRightDownLine },
]
