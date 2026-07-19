"use client"

import { RiFolderOpenLine, RiImageAddLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function OpenControls({
  currentDraftName,
  onOpenImage,
  onOpenProject,
}: {
  currentDraftName: string | null
  onOpenImage: () => void
  onOpenProject: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg">
              <RiFolderOpenLine />
              <span className="hidden xl:inline">Open</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {currentDraftName ? `Editing ${currentDraftName}` : "Open"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenImage}>
          <RiImageAddLine />
          Open image
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenProject}>
          <RiFolderOpenLine />
          Open project…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
