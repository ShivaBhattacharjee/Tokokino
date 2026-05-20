"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { ease } from "@/components/landing/constants"

type StepId = "open" | "capture" | "compose" | "ship"

type FlowStep = {
  id: StepId
  k: string
  eyebrow: string
  title: string
  body: string
  label: string
}

type SpotlightRegion = {
  left: string
  top: string
  width: string
  height: string
}

const FLOW_STEPS = [
  {
    id: "open",
    k: "01",
    eyebrow: "Open",
    title: "Start inside Noctivy",
    body: "Open the actual editor shell. This preview is the real app route rendered in readonly mode, so the tour points at the same UI people will use.",
    label: "APP SHELL",
  },
  {
    id: "capture",
    k: "02",
    eyebrow: "Capture",
    title: "Drop a file or paste a URL",
    body: "Focus the intake area where screenshots enter by upload, clipboard, or URL capture.",
    label: "CAPTURE AREA",
  },
  {
    id: "compose",
    k: "03",
    eyebrow: "Compose",
    title: "Pick presets or go manual",
    body: "Focus the canvas and editing surface where frames, backdrops, annotations, presets, and assets come together.",
    label: "DESIGN CANVAS",
  },
  {
    id: "ship",
    k: "04",
    eyebrow: "Ship",
    title: "Export or share",
    body: "Focus the controls used to copy, download, or share the finished screenshot.",
    label: "EXPORT CONTROLS",
  },
] as const satisfies readonly FlowStep[]

const SPOTLIGHT_REGIONS = {
  open: { left: "0%", top: "0%", width: "100%", height: "100%" },
  capture: { left: "18%", top: "18%", width: "61%", height: "61%" },
  compose: { left: "0%", top: "40%", width: "15%", height: "52%" },
  ship: { left: "88%", top: "0.8%", width: "12.2%", height: "3.6%" },
} as const satisfies Record<StepId, SpotlightRegion>

const DEMO_PREVIEW_SRC =
  "https://pub-4a1f61370c844ff69cc9d1a7b3689d25.r2.dev/demo.png"

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState<StepId>("compose")

  return (
    <section
      id="how-it-works"
      className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65, ease }}
        className="mb-10 flex max-w-4xl flex-col gap-5"
      >
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
            {"// How it works"}
          </span>
          <h2 className="max-w-2xl text-2xl tracking-tight sm:text-3xl lg:text-4xl">
            A guided tour of the real editor.
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-foreground/58">
          The preview uses the same demo shot shown in the product mockup. Click
          a step to move the spotlight over the matching part of the flow.
        </p>
      </motion.div>

      <div className="relative overflow-hidden rounded-md border border-border/70 bg-background/55 backdrop-blur-md">
        <div className="grid min-h-[28rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.75, ease }}
            className="relative flex min-h-[24rem] items-center justify-center border-b border-border/60 p-4 sm:p-6 lg:border-r lg:border-b-0"
          >
            <ReadonlyEditorPreview activeStep={activeStep} />
          </motion.div>

          <div className="flex flex-col border-border/60">
            {FLOW_STEPS.map((step) => {
              const isActive = activeStep === step.id
              const isShip = step.id === "ship"

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`group relative bg-background/35 px-5 text-left transition hover:bg-background/65 focus-visible:ring-1 focus-visible:ring-primary/70 focus-visible:outline-none sm:px-7 ${
                    isShip ? "border-b-0 py-3" : "border-b border-border/60 py-4"
                  }`}
                  aria-expanded={isActive}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={
                        isActive
                          ? "pt-0.5 font-mono text-xs text-primary"
                          : "pt-0.5 font-mono text-xs text-foreground/28"
                      }
                    >
                      {step.k}
                    </span>
                    <span
                      className={
                        isActive
                          ? "mt-[0.35rem] size-2.5 shrink-0 bg-primary shadow-[0_0_0_7px_oklch(from_var(--primary)_l_c_h_/_0.13)]"
                          : "mt-[0.35rem] size-2.5 shrink-0 bg-foreground/22 group-hover:bg-primary/60"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          isActive
                            ? "font-mono text-[10px] tracking-[0.24em] text-primary uppercase"
                            : "font-mono text-[10px] tracking-[0.24em] text-accent-foreground/78 uppercase"
                        }
                      >
                        {step.eyebrow}
                      </p>
                      <h3
                        className={
                          isActive
                            ? "mt-1 text-[17px] font-semibold tracking-tight text-foreground"
                            : "mt-1 text-[17px] font-medium tracking-tight text-foreground/82"
                        }
                      >
                        {step.title}
                      </h3>
                      <motion.div
                        initial={false}
                        animate={{
                          height: isActive ? "auto" : 0,
                          opacity: isActive ? 1 : 0,
                          marginTop: isActive ? (isShip ? 8 : 14) : 0,
                        }}
                        transition={{ duration: 0.32, ease }}
                        className="overflow-hidden"
                      >
                        <p
                          className={`max-w-md text-sm text-foreground/58 ${
                            isShip ? "leading-5" : "leading-6"
                          }`}
                        >
                          {step.body}
                        </p>
                      </motion.div>
                    </div>
                    <motion.span
                      animate={{ rotate: isActive ? 45 : 0 }}
                      transition={{ duration: 0.25, ease }}
                      className={
                        isActive
                          ? "font-mono text-lg text-primary"
                          : "font-mono text-lg text-foreground/32"
                      }
                    >
                      +
                    </motion.span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function ReadonlyEditorPreview({ activeStep }: { activeStep: StepId }) {
  const region = SPOTLIGHT_REGIONS[activeStep]
  const spotlightRadius = activeStep === "ship" ? "4px" : "8px"

  return (
    <div className="relative aspect-[16/10] w-full max-w-[58rem] overflow-hidden rounded-md border border-border/70 bg-background">
      <img
        src={DEMO_PREVIEW_SRC}
        alt="Noctivy editor demo preview"
        className="h-full w-full object-cover opacity-80 saturate-[0.82]"
      />

      <div className="pointer-events-none absolute inset-0 bg-background/48" />

      <motion.div
        className="pointer-events-none absolute rounded-md border border-primary/80 bg-primary/10"
        animate={{ ...region, borderRadius: spotlightRadius }}
        transition={{ duration: 0.42, ease }}
      />
    </div>
  )
}
