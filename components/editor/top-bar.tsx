"use client"

import * as React from "react"
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiDownload2Line,
  RiEyeLine,
  RiFileCopyLine,
  RiFolderOpenLine,
  RiSaveLine,
  RiShareForwardLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function TopBar() {
  const [name, setName] = React.useState("Untitled capture")

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3">
      {/* Brand */}
      <div className="flex items-center gap-2 pr-1">
        <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/70">
          <span className="size-3 rounded-[3px] bg-foreground" />
        </span>
        <span className="text-[14px] font-medium tracking-tight">
         Pta nhi name
        </span>
      </div>

      {/* File name */}
      <div className="flex min-w-0 items-center gap-2 pl-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[3rem] rounded-md border border-transparent bg-transparent py-1 px-2 text-center text-[14px] font-medium tracking-tight outline-none hover:border-border focus:border-border focus:bg-secondary/60"
          spellCheck={false}
          size={Math.max(name.length, 8)}
        />
      </div>

      {/* History cluster */}
      <div className="tool-cluster ml-2">
        <IconAction label="Undo" icon={RiArrowGoBackLine} shortcut="⌘Z" />
        <IconAction label="Redo" icon={RiArrowGoForwardLine} shortcut="⌘⇧Z" />
      </div>

      {/* Open + Save */}
      <Button variant="outline" size="lg" className="ml-1">
        <RiFolderOpenLine />
        Open
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => toast("Saved")}
      >
        <RiSaveLine />
        Save
      </Button>

      {/* Preview */}
      <Button variant="outline" size="lg">
        <RiEyeLine />
        Preview
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              onClick={() => toast("Share link copied")}
            >
              <RiShareForwardLine />
              Share
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Copy a shareable link</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              onClick={() => toast("Image copied to clipboard")}
            >
              <RiFileCopyLine />
              Copy
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Copy as PNG</TooltipContent>
        </Tooltip>

        <Button
          size="lg"
          className={cn("h-9 rounded-xl px-3 text-[12px] font-medium")}
          onClick={() => toast("Export coming soon")}
        >
          <RiDownload2Line />
          Export
        </Button>
      </div>
    </header>
  )
}

function IconAction({
  label,
  icon: Icon,
  shortcut,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? (
          <kbd className="ml-1.5 font-mono text-[10px] opacity-80">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
