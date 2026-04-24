"use client"

export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border/60 bg-background px-3 font-mono text-[10px] tracking-wide text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-emerald-500/90"
          />
          <span className="text-foreground/80">READY</span>
        </span>
        <Dot />
        <span>16:10</span>
        <Dot />
        <span>BROWSER</span>
        <Dot />
        <span>PAD 90PX</span>
        <Dot />
        <span>TILT 6°/-10°</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <kbd className="inline-flex h-4 items-center justify-center rounded border border-border px-1 font-mono text-[9px] text-foreground/80">
            ⌘K
          </kbd>
          <span>Command palette</span>
        </span>
        <Dot />
        <span>AUTOSAVED 2S AGO</span>
      </div>
    </footer>
  )
}

function Dot() {
  return <span className="opacity-40">·</span>
}
