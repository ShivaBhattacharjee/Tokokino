"use client"

import * as React from "react"
import {
  RiArrowDownSLine,
  RiGalleryLine,
  RiHardDrive2Line,
  RiLogoutBoxRLine,
} from "@remixicon/react"
import Link from "next/link"
import { toast } from "sonner"

import { AccountAvatar } from "@/components/editor/account-avatar"
import {
  AspectPopover,
  findAspectOption,
} from "@/components/editor/aspect-popover"
import { FramePopover } from "@/components/editor/frame-popover"
import { PresentPresetsSection } from "@/components/editor/present-presets-section"
import { StorageDialog } from "@/components/editor/storage-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { signOut, useSession } from "@/lib/auth-client"
import { getFrameAspectCompatibilityWarning } from "@/lib/editor/frame-aspect-compatibility"
import { cn } from "@/lib/utils"
import {
  useActiveCanvasField,
  useEditorStore,
  useSelectedScreenshotSlot,
} from "@/lib/editor/store"
import type { AspectState, DeviceFrame } from "@/lib/editor/store"
import { ArrowRight } from "lucide-react"

export function EffectsSidebar({
  className,
  hideAccount = false,
  popoverAlign = "start",
}: {
  className?: string
  hideAccount?: boolean
  stacked?: boolean
  popoverAlign?: "start" | "end"
}) {
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspect = useActiveCanvasField((c) => c.aspect)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const currentDraftName = useEditorStore((s) => s.currentDraft?.name)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const frame = useActiveCanvasField((c) => c.frame)
  const objectFit = useActiveCanvasField((c) => c.objectFit)
  const tweet = useActiveCanvasField((c) => c.tweet)
  const setAspect = useEditorStore((s) => s.setAspect)
  const setCanvasAspect = useEditorStore((s) => s.setCanvasAspect)
  const setFrameForMatchingScreenshots = useEditorStore(
    (s) => s.setFrameForMatchingScreenshots
  )
  const selectedSlot = useSelectedScreenshotSlot()
  const activeFrame = frame
  const activeFrameRef = React.useRef(activeFrame)
  React.useLayoutEffect(() => {
    activeFrameRef.current = activeFrame
  })

  const aspect =
    bulkEditMode || tweet ? (canvasAspect ?? globalAspect) : globalAspect
  const projectName = currentDraftName?.trim()

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

  const handleAspectChange = React.useCallback(
    (id: string, custom?: { w: number; h: number }) => {
      const frame = activeFrameRef.current
      if (custom) {
        const nextAspect = { id, w: custom.w, h: custom.h }
        if (bulkEditMode) {
          setCanvasAspect(activeCanvasId, nextAspect)
        } else {
          setAspect(nextAspect)
        }
        setCustomSize(custom)
        showCompatibilityWarning(nextAspect, frame, "Custom size")
        return
      }
      const opt = findAspectOption(id)
      if (opt) {
        const nextAspect = { id, w: opt.w, h: opt.h }
        if (bulkEditMode) {
          setCanvasAspect(activeCanvasId, nextAspect)
        } else {
          setAspect(nextAspect)
        }
        setCustomSize(null)
        showCompatibilityWarning(nextAspect, frame, opt.name)
      }
    },
    [
      bulkEditMode,
      activeCanvasId,
      setAspect,
      setCanvasAspect,
      activeFrameRef,
      showCompatibilityWarning,
    ]
  )

  const header = (
    <>
      <div className="label-eyebrow mb-4 flex min-w-0 items-center gap-1.5">
        <span>App</span>
        <span className="text-muted-foreground/45">/</span>
        <span
          className="truncate text-foreground/70"
          title={projectName || "New project"}
        >
          {projectName || "New project"}
        </span>
      </div>
      <div className="space-y-4">
        <div>
          <SectionLabel>Aspect Ratio</SectionLabel>
          <AspectPopover
            value={aspect.id}
            onChange={handleAspectChange}
            align={popoverAlign}
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
            align={popoverAlign}
            previewImage={selectedSlot ? selectedSlot.src : undefined}
            imageFit={selectedSlot?.objectFit ?? objectFit ?? "cover"}
            disabled={Boolean(tweet)}
            disabledLabel="Disabled for X posts"
            disabledTooltip="Frames are disabled for X posts because the post card already provides the frame and spacing."
            onChange={(nextFrame) => {
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
    </>
  )

  // Mobile: one fully-scrollable column, no fixed sections
  if (hideAccount) {
    return (
      <aside
        className={cn(
          "h-full w-full [scrollbar-width:none] overflow-y-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
      >
        <div className="px-4 pt-4 pb-3">{header}</div>
        <PresentPresetsSection flat />
      </aside>
    )
  }

  // Desktop: fixed header + independently-scrolling presets
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[268px] shrink-0 flex-col overflow-hidden border-r border-dashed border-border/70 bg-sidebar",
        className
      )}
    >
      <div className="shrink-0 px-4 pt-5 pb-4">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col pb-4">
        <PresentPresetsSection />
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

export function AccountTile() {
  const { data: session, isPending: isAuthPending } = useSession()
  const [expanded, setExpanded] = React.useState(false)
  const [storageOpen, setStorageOpen] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true)
  }, [])

  const user = session?.user
  if (!isHydrated || isAuthPending) {
    return (
      <div className="shrink-0 border-t border-dashed border-border/70 px-4 py-2.5">
        <div
          className="flex h-12 w-full items-center gap-2.5 rounded-md px-1.5"
          aria-hidden
        >
          <span className="size-8 shrink-0 rounded-full bg-secondary ring-1 ring-border/70" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-24 rounded bg-secondary" />
            <span className="block h-2.5 w-32 rounded bg-secondary/80" />
          </span>
          <span className="size-4 shrink-0 rounded bg-secondary/80" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="shrink-0 border-t border-dashed border-border/70 px-4 py-2.5">
        <Link
          href="/login"
          className="group relative flex h-10 w-full items-center rounded-md bg-primary px-3 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            Login{" "}
            <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1" />
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
            <AccountAvatar
              src={user.image}
              name={displayName}
              className="size-8 rounded-full ring-1 ring-border/70"
              iconClassName="size-4"
            />
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
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[236px] rounded-lg border border-border/70 bg-card/95 p-2 shadow-xl"
        >
          <Link
            href="/app/shares"
            onClick={() => setExpanded(false)}
            className="flex h-8 w-full touch-manipulation items-center gap-2.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors outline-none [-webkit-tap-highlight-color:transparent] hover:bg-secondary/60 focus:ring-0 focus-visible:ring-0 sm:focus-visible:ring-2 sm:focus-visible:ring-primary/30"
          >
            <RiGalleryLine className="size-4 shrink-0 text-muted-foreground" />
            My Shares
          </Link>
          <button
            type="button"
            className="flex h-8 w-full touch-manipulation items-center gap-2.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors outline-none [-webkit-tap-highlight-color:transparent] hover:bg-secondary/60 focus:ring-0 focus-visible:ring-0 sm:focus-visible:ring-2 sm:focus-visible:ring-primary/30"
            onClick={() => {
              setExpanded(false)
              setStorageOpen(true)
            }}
          >
            <RiHardDrive2Line className="size-4 shrink-0 text-muted-foreground" />
            Storage
          </button>
          <button
            type="button"
            disabled={isSigningOut}
            className="flex h-8 w-full touch-manipulation items-center gap-2.5 rounded-md px-2 text-xs font-medium text-destructive transition-colors outline-none [-webkit-tap-highlight-color:transparent] hover:bg-destructive/10 focus:ring-0 focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-60 sm:focus-visible:ring-2 sm:focus-visible:ring-destructive/30"
            onClick={() => void handleSignOut()}
          >
            <RiLogoutBoxRLine className="size-4 shrink-0" />
            {isSigningOut ? "Logging out..." : "Logout"}
          </button>
        </PopoverContent>
      </Popover>
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} />
    </div>
  )
}
