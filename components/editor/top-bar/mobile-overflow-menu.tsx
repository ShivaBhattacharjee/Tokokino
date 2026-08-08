"use client"

import * as React from "react"
import {
  RiAddLine,
  RiEyeLine,
  RiFeedbackLine,
  RiFileCopyLine,
  RiFolderOpenLine,
  RiFileAddLine,
  RiImageAddLine,
  RiVideoAddLine,
  RiLayoutGridLine,
  RiMoreLine,
  RiMoonLine,
  RiSaveLine,
  RiShareForwardLine,
  RiSparkling2Line,
  RiSunLine,
} from "@remixicon/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MAX_CANVASES, useEditorStore } from "@/lib/editor/store"
import { isVideoSrc } from "@/lib/editor/media-type"

export function MobileOverflowMenu({
  bulkEditMode,
  onBulkEditClick,
  onSaveClick,
  onShareClick,
  onCopyPng,
  isCopyingPng,
  isPreparingShare,
  onNewClick,
  onOpenImageClick,
  onOpenVideoClick,
  onOpenProjectClick,
  onTemplatesClick,
  onFeedbackClick,
}: {
  bulkEditMode: boolean
  onBulkEditClick: () => void
  onSaveClick: () => void
  onShareClick: () => void
  onCopyPng: () => Promise<void>
  isCopyingPng: boolean
  isPreparingShare: boolean
  onNewClick: () => void
  onOpenImageClick: () => void
  onOpenVideoClick: () => void
  onOpenProjectClick: () => void
  onTemplatesClick: () => void
  onFeedbackClick: () => void
}) {
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
  // Video can't be copied to the clipboard — hide the still-frame copy action.
  const isVideoCanvas = useEditorStore((s) => {
    const canvas = s.present.canvases.find(
      (c) => c.id === s.present.activeCanvasId
    )
    return canvas ? isVideoSrc(canvas.screenshot) : false
  })
  const setIsPreviewMode = useEditorStore((s) => s.setIsPreviewMode)
  const addCanvas = useEditorStore((s) => s.addCanvas)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const atCanvasCap = canvasCount >= MAX_CANVASES
  const [menuOpen, setMenuOpen] = React.useState(false)

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
          File
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onNewClick}>
          <RiFileAddLine />
          New project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProjectClick}>
          <RiFolderOpenLine />
          Open project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenImageClick}>
          <RiImageAddLine />
          Add image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenVideoClick}>
          <RiVideoAddLine />
          Add video
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false)
            onTemplatesClick()
          }}
        >
          <RiSparkling2Line />
          Templates
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="label-eyebrow !px-2 !py-1.5">
          Workspace
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onBulkEditClick} disabled={isAnimateMode}>
          <RiLayoutGridLine />
          {bulkEditMode ? "Exit bulk edit" : "Bulk edit"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={atCanvasCap}
          onClick={() => {
            const id = addCanvas()
            if (!id) toast.error(`Canvas limit reached (${MAX_CANVASES})`)
          }}
        >
          <RiAddLine />
          Add canvas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsPreviewMode(true)}>
          <RiEyeLine />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSaveClick}>
          <RiSaveLine />
          Save
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShareClick} disabled={isPreparingShare}>
          <RiShareForwardLine />
          Share
        </DropdownMenuItem>

        {!isVideoCanvas && !isAnimateMode && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false)
                void onCopyPng()
              }}
              disabled={isCopyingPng}
            >
              <RiFileCopyLine />
              {isCopyingPng ? "Copying…" : "Copy as PNG"}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false)
            onFeedbackClick()
          }}
        >
          <RiFeedbackLine />
          Send feedback
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault()
            toast.dismiss()
            setMenuOpen(false)
            setTheme(isDark ? "light" : "dark")
          }}
        >
          {isDark ? <RiSunLine /> : <RiMoonLine />}
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
