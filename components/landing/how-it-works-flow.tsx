import { RiArrowDownLine, RiCheckLine } from "@remixicon/react"

const BUILD = [
  { step: "Capture", detail: "Screenshot, URL, recording, or post" },
  { step: "Compose", detail: "Device frame, background, depth" },
  { step: "Context", detail: "Text, marks, and extra shots" },
] as const

const SHIP = [
  { step: "Animate", detail: "Timeline clips and easing curves" },
  { step: "Export", detail: "Stills, video, or a public link" },
] as const

function Check() {
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <RiCheckLine className="size-3" />
    </span>
  )
}

function Row({ step, detail }: { step: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <Check />
      <span className="text-[13px] leading-5 text-foreground/85">
        {step}
        <span className="text-foreground/45"> — {detail}</span>
      </span>
    </li>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center py-4 text-foreground/25">
      <RiArrowDownLine className="size-4" />
    </div>
  )
}

export function HowItWorksFlow() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
        <div className="rounded-[8px] border border-border/40 bg-background/60 px-6 py-10 sm:px-10">
          <div className="mx-auto max-w-[19rem]">
            <div className="rounded-md border border-border/50 bg-background/70 px-4 py-3">
              <p className="font-mono text-[11px] text-foreground/75">
                screenshot.png
              </p>
              <p className="mt-1 text-[12px] text-foreground/45">
                Dropped on the canvas · 2560 × 1440
              </p>
            </div>

            <Arrow />

            <div className="overflow-hidden rounded-md border border-border/50 bg-background/70">
              <p className="border-b border-border/50 px-4 py-2.5 text-center text-[13px] font-medium text-foreground">
                Tokokino
              </p>
              <ul className="flex flex-col gap-3 px-4 py-4">
                {BUILD.map((item) => (
                  <Row key={item.step} {...item} />
                ))}
              </ul>
              <ul className="flex flex-col gap-3 border-t border-border/50 px-4 py-4">
                {SHIP.map((item) => (
                  <Row key={item.step} {...item} />
                ))}
              </ul>
            </div>

            <Arrow />

            <div className="rounded-md border border-border/50 bg-background/70 px-4 py-3">
              <p className="font-mono text-[11px] text-primary">
                launch-demo.webm
              </p>
              <p className="mt-1 text-[12px] text-foreground/45">
                Encoded on your device · 4K · 2.4 MB
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm">
        <div className="flex h-full items-center rounded-[8px] border border-border/40 bg-background/60 px-6 py-12 sm:px-12">
          <p className="text-xl leading-[1.45] font-medium tracking-[-0.025em] sm:text-2xl">
            You drop in a capture.
            <br />
            Tokokino frames, styles, and animates it.
            <br />
            <span className="text-primary">You export the file.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
