"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiLoginBoxLine,
  RiLogoutBoxRLine,
  RiUserLine,
} from "@remixicon/react"
import Link from "next/link"
import { toast } from "sonner"

import {
  AspectPopover,
  findAspectOption,
} from "@/components/editor/aspect-popover"
import { FramePopover } from "@/components/editor/frame-popover"
import { PresentPresetsSection } from "@/components/editor/present-presets-section"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { signOut, useSession } from "@/lib/auth-client"
import { getFrameAspectCompatibilityWarning } from "@/lib/editor/frame-aspect-compatibility"
import { cn } from "@/lib/utils"
import {
  useActiveCanvasField,
  useEditorStore,
  useSelectedScreenshotSlot,
} from "@/lib/editor/store"
import type { AspectState, DeviceFrame } from "@/lib/editor/store"

export function EffectsSidebar({
  className,
}: {
  className?: string
  stacked?: boolean
}) {
  const aspect = useEditorStore((s) => s.present.aspect)
  const frame = useActiveCanvasField((c) => c.frame)
  const setAspect = useEditorStore((s) => s.setAspect)
  const setFrameForMatchingScreenshots = useEditorStore(
    (s) => s.setFrameForMatchingScreenshots
  )
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const selectedSlot = useSelectedScreenshotSlot()
  const activeFrame = selectedSlot?.frame ?? frame

  const [customSize, setCustomSize] = React.useState<{
    w: number
    h: number
  } | null>(null)

  const showCompatibilityWarning = React.useCallback(
    (nextAspect: AspectState, nextFrame: DeviceFrame, aspectName?: string) => {
      const warning = getFrameAspectCompatibilityWarning({
        aspect: nextAspect,
        frame: nextFrame,
        aspectName,
      })

      if (!warning) return

      toast.warning(warning.title, {
        description: warning.description,
        id: "frame-aspect-compatibility",
        position: "top-center",
      })
    },
    []
  )

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[268px] shrink-0 flex-col overflow-hidden border-r border-dashed border-border/70 bg-sidebar",
        className
      )}
    >
      <div className="shrink-0 px-4 pt-5 pb-4">
        <span className="label-eyebrow mb-4 block">Canvas</span>
        <div className="space-y-4">
          <div>
            <SectionLabel>Aspect Ratio</SectionLabel>
            <AspectPopover
              value={aspect.id}
              onChange={(id, custom) => {
                if (custom) {
                  const nextAspect = { id, w: custom.w, h: custom.h }
                  setAspect(nextAspect)
                  setCustomSize(custom)
                  showCompatibilityWarning(
                    nextAspect,
                    activeFrame,
                    "Custom size"
                  )
                  return
                }
                const opt = findAspectOption(id)
                if (opt) {
                  const nextAspect = { id, w: opt.w, h: opt.h }
                  setAspect(nextAspect)
                  setCustomSize(null)
                  showCompatibilityWarning(nextAspect, activeFrame, opt.name)
                }
              }}
            />
            {customSize ? (
              <p className="mt-1.5 px-0.5 font-mono text-[10px] text-muted-foreground">
                Custom · {customSize.w} × {customSize.h}
              </p>
            ) : null}
          </div>
          <div>
            <SectionLabel>Frame</SectionLabel>
            <FramePopover
              value={activeFrame}
              previewImage={selectedSlot ? selectedSlot.src : undefined}
              onChange={(nextFrame) => {
                if (selectedSlot) {
                  updateScreenshotSlot(selectedSlot.id, { frame: nextFrame })
                  return
                }
                setFrameForMatchingScreenshots(nextFrame)
                showCompatibilityWarning(
                  aspect,
                  nextFrame,
                  findAspectOption(aspect.id)?.name
                )
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="pb-4">
            <PresentPresetsSection />
          </div>
        </ScrollArea>
      </div>
      <AccountTile />
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-medium text-foreground">{children}</p>
  )
}

function AccountTile() {
  const { data: session } = useSession()
  const [expanded, setExpanded] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const user = session?.user
  if (!user) {
    return (
      <div className="shrink-0 border-t border-dashed border-border/70 px-4 py-2.5">
        <Link
          href="/login"
          className="relative flex h-10 w-full items-center rounded-md bg-primary px-3 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            Login
          </span>
        </Link>
      </div>
    )
  }

  const displayName = user.name || user.email || "Account"

  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) {
        toast.error(error.message ?? "Sign out failed")
        setIsSigningOut(false)
        return
      }
      toast.success("Signed out")
    } catch (err) {
      console.error(err)
      toast.error("Sign out failed")
      setIsSigningOut(false)
    }
  }

  return (
    <div className="shrink-0 border-t border-dashed border-border/70 px-4 py-2.5">
      <Popover open={expanded} onOpenChange={setExpanded}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-12 w-full items-center gap-2.5 rounded-md px-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            aria-expanded={expanded}
          >
            {user.image ? (
              <span
                className="size-8 shrink-0 rounded-full bg-cover bg-center ring-1 ring-border/70"
                style={{ backgroundImage: `url(${user.image})` }}
                aria-hidden
              />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border/70">
                <RiUserLine className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {displayName}
              </span>
              {user.email && user.email !== displayName ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </span>
            <RiArrowDownSLine
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[236px] rounded-lg border border-border/70 bg-card/95 p-2 shadow-xl"
        >
          <button
            type="button"
            disabled={isSigningOut}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-md text-xs font-medium text-muted-foreground disabled:pointer-events-none disabled:opacity-60"
            onClick={() => void handleSignOut()}
          >
            <RiLogoutBoxRLine className="size-4" />
            {isSigningOut ? "Logging out..." : "Logout"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
