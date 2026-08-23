"use client"

import * as React from "react"
import {
  RiCloudOffLine,
  RiFileAddLine,
  RiFolderOpenLine,
  RiHardDrive2Line,
  RiImageAddLine,
  RiLoader4Line,
  RiVideoAddLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function OpenControls({
  currentDraftName,
  isOffline = false,
  isSavingOffline = false,
  onNewProject,
  onOpenImage,
  onOpenVideo,
  onOpenProject,
  onToggleOffline,
}: {
  currentDraftName: string | null
  /** The editor is already stored on this device. */
  isOffline?: boolean
  /** The shell is being cached — the item stays put but locks. */
  isSavingOffline?: boolean
  onNewProject: () => void
  onOpenImage: () => void
  onOpenVideo: () => void
  onOpenProject: () => void
  /** Omit to drop offline storage from the menu entirely. */
  onToggleOffline?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              variant="outline"
              size="lg"
              onMouseEnter={() => setOpen(true)}
              onPointerDown={(event) => {
                if (open && event.pointerType === "mouse") {
                  event.preventDefault()
                }
              }}
            >
              <RiFolderOpenLine />
              <span className="hidden xl:inline">File</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {currentDraftName ? `Editing ${currentDraftName}` : "File"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-52"
        // Hover already opened the menu, so the click that follows lands on the
        // trigger while the menu is up. Without this the dismiss layer reads it
        // as an outside press and closes what the pointer is still over.
        onPointerDownOutside={(event) => {
          if (triggerRef.current?.contains(event.target as Node)) {
            event.preventDefault()
          }
        }}
      >
        <DropdownMenuItem className="cursor-pointer" onClick={onNewProject}>
          <RiFileAddLine />
          New project
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenProject}>
          <RiFolderOpenLine />
          Open project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenImage}>
          <RiImageAddLine />
          Add image
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenVideo}>
          <RiVideoAddLine />
          Add video
        </DropdownMenuItem>
        {onToggleOffline ? (
          <>
            <DropdownMenuSeparator />
            {/* onSelect, not onClick: Radix suppresses it while disabled. */}
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isSavingOffline}
              onSelect={onToggleOffline}
            >
              {isSavingOffline ? (
                <RiLoader4Line className="animate-spin" />
              ) : isOffline ? (
                <RiCloudOffLine />
              ) : (
                <RiHardDrive2Line />
              )}
              {isSavingOffline
                ? "Saving offline…"
                : isOffline
                  ? "Turn off offline"
                  : "Make available offline"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
