"use client"

import {
  RiFolderOpenLine,
  RiImageAddLine,
  RiVideoAddLine,
} from "@remixicon/react"

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
  onOpenVideo,
  onOpenProject,
}: {
  currentDraftName: string | null
  onOpenImage: () => void
  onOpenVideo: () => void
  onOpenProject: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg">
              <RiFolderOpenLine />
              <span className="hidden xl:inline">File</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {currentDraftName ? `Editing ${currentDraftName}` : "File"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenProject}>
          <RiFolderOpenLine />
          Open project
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenImage}>
          <RiImageAddLine />
          Add image
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenVideo}>
          <RiVideoAddLine />
          Add video
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
