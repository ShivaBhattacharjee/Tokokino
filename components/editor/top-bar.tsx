"use client"

import * as React from "react"
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiDownload2Line,
  RiEyeLine,
  RiFileCopyLine,
  RiFolderOpenLine,
  RiMoreLine,
  RiRefreshLine,
  RiSaveLine,
  RiShareForwardLine,
  RiUploadCloud2Line,
  RiLayoutMasonryLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function TopBar() {
  const [name, setName] = React.useState("Untitled capture")

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background px-2 sm:px-3">
      {/* Brand */}
      <div className="flex items-center gap-2 pr-1">
        <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/70">
          <span className="size-3 rounded-[3px] bg-foreground" />
        </span>
        <span className="hidden text-[14px] font-medium tracking-tight sm:inline">
          Pta nhi name
        </span>
      </div>

      {/* File name — centered on mobile/iPad, inline on desktop */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 pl-1 sm:pl-2 xl:flex-none xl:justify-start">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-12 max-w-[14rem] rounded-md border border-transparent bg-transparent py-1 px-2 text-center text-[13px] font-medium tracking-tight outline-none hover:border-border focus:border-border focus:bg-secondary/60 sm:max-w-none sm:text-[14px] xl:text-left"
          spellCheck={false}
          size={Math.max(name.length, 8)}
        />
      </div>

      {/* History cluster — desktop only */}
      <div className="ml-2 hidden xl:block">
        <IconAction label="Undo" icon={RiArrowGoBackLine} shortcut="⌘Z" />
        <IconAction label="Redo" icon={RiArrowGoForwardLine} shortcut="⌘⇧Z" />
      </div>

      {/* Open + Save — desktop only */}
      <div className="hidden items-center gap-1.5 xl:flex">
        <OpenProjectDialog />
        <Button
          variant="outline"
          size="lg"
          onClick={() => toast("Saved")}
        >
          <RiSaveLine />
          Save
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => toast("Reset to defaults")}
        >
          <RiRefreshLine />
          Reset
        </Button>
        <Button variant="outline" size="lg">
          <RiEyeLine />
          Preview
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Right cluster — desktop only */}
        <div className="hidden items-center gap-1.5 xl:flex">
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
            <TooltipContent side="bottom">
              Copy a shareable link
            </TooltipContent>
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
        </div>

        {/* Mobile overflow menu */}
        <MobileOverflowMenu />

        {/* Export (always visible) */}
        <Button
          size="lg"
          className={cn("h-8 px-3 text-[12px] font-medium text-white")}
          onClick={() => toast("Export coming soon")}
        >
          <RiDownload2Line />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  )
}

function OpenProjectDialog() {
  const [activeTab, setActiveTab] = React.useState<"templates" | "projects">("templates")

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="ml-1 cursor-pointer">
          <RiFolderOpenLine />
          Open
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[960px] w-[960px] h-[640px] flex flex-col p-0 bg-popover/95 backdrop-blur-md border-border/60 overflow-hidden">
        <div className="flex h-full">
          {/* Left Sidebar */}
          <div className="w-64 border-r border-border/60 bg-secondary/10 flex flex-col p-4 gap-2">
            <div className="mb-6 px-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Open project</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Choose a template or import your existing work.</p>
            </div>
            
            <SidebarNavItem 
              active={activeTab === "templates"} 
              onClick={() => setActiveTab("templates")}
              icon={RiLayoutMasonryLine}
              label="Template Gallery"
              description="Start from a layout"
            />
            
            <SidebarNavItem 
              active={activeTab === "projects"} 
              onClick={() => setActiveTab("projects")}
              icon={RiUploadCloud2Line}
              label="Import Projects"
              description="Continue your work"
            />
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-background/20">
            <div className="flex h-14 shrink-0 items-center border-b border-border/40 px-6">
              <span className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
                {activeTab === "templates" ? "Professional Templates" : "Existing Files"}
              </span>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              {activeTab === "templates" ? (
                <div className="grid grid-cols-2 gap-4">
                  {TEMPLATE_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className="group flex flex-col gap-3 rounded-xl border-2 border-border bg-secondary/10 p-4 text-left transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
                    >
                      <div className="aspect-[16/10] w-full rounded-lg bg-secondary/30 border border-border flex items-center justify-center overflow-hidden">
                         <div className="size-full bg-gradient-to-br from-secondary/40 to-transparent group-hover:scale-105 transition-transform" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-foreground">{item.title}</p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{item.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3">
                  {PROJECT_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border-2 border-border bg-secondary/10 px-5 py-4 text-left transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                          <RiSaveLine className="size-5" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-foreground">{item.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-0.5">{item.updatedAt}</p>
                        </div>
                      </div>
                      <RiFolderOpenLine className="size-5 text-muted-foreground/60" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SidebarNavItem({ active, onClick, icon: Icon, label, description }: { 
  active: boolean, 
  onClick: () => void, 
  icon: any, 
  label: string, 
  description: string 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all cursor-pointer border-2",
        active 
          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
          : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
      )}
    >
      <Icon className={cn("size-5", active ? "text-white" : "text-muted-foreground")} />
      <div>
        <p className="text-sm font-bold leading-none">{label}</p>
        <p className={cn("text-[10px] mt-1.5 font-medium opacity-80", active ? "text-white" : "text-muted-foreground")}>
          {description}
        </p>
      </div>
    </button>
  )
}

function MobileOverflowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="More actions"
          className="xl:hidden"
        >
          <RiMoreLine />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
          File
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toast("Opening…")}>
          <RiFolderOpenLine />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast("Saved")}>
          <RiSaveLine />
          Save
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast("Reset to defaults")}>
          <RiRefreshLine />
          Reset
        </DropdownMenuItem>
        <DropdownMenuItem>
          <RiEyeLine />
          Preview
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
          History
        </DropdownMenuLabel>
        <DropdownMenuItem>
          <RiArrowGoBackLine />
          Undo
        </DropdownMenuItem>
        <DropdownMenuItem>
          <RiArrowGoForwardLine />
          Redo
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
          Share
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toast("Share link copied")}>
          <RiShareForwardLine />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast("Image copied to clipboard")}>
          <RiFileCopyLine />
          Copy as PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

const TEMPLATE_ITEMS = [
  {
    id: "clean-gradient",
    title: "Clean Gradient",
    description: "Minimal gradient background with soft shadows",
  },
  {
    id: "terminal-window",
    title: "Terminal Window",
    description: "Code-style capture with dark shell framing",
  },
  {
    id: "social-card",
    title: "Social Card",
    description: "Square layout optimized for social sharing",
  },
]

const PROJECT_ITEMS = [
  {
    id: "landing-page-revamp",
    title: "Landing Page Revamp",
    updatedAt: "Updated 2 hours ago",
  },
  {
    id: "portfolio-hero-shot",
    title: "Portfolio Hero Shot",
    updatedAt: "Updated yesterday",
  },
  {
    id: "mobile-app-preview",
    title: "Mobile App Preview",
    updatedAt: "Updated 4 days ago",
  },
]
