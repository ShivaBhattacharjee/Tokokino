"use client"

import * as React from "react"
import {
  RiBringToFront,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiFileCopyLine,
  RiMoreFill,
  RiSendToBack,
} from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const iconBtnClass =
  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shrink-0"

export const popoverContentClass =
  "border-border/60 bg-popover/95 backdrop-blur-md"

export const toolbarSurfaceClass =
  "pointer-events-auto flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"

type Side = "top" | "bottom" | "left" | "right"
type Align = "start" | "center" | "end"

export function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-border" />
}

export function ToolbarSurface({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(toolbarSurfaceClass, className)}
      onPointerDown={(e) => {
        e.stopPropagation()
        props.onPointerDown?.(e)
      }}
      onClick={(e) => {
        e.stopPropagation()
        props.onClick?.(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        props.onDoubleClick?.(e)
      }}
    >
      {children}
    </div>
  )
}

type ToolbarButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  tooltip?: React.ReactNode
  tooltipSide?: Side
  active?: boolean
  destructive?: boolean
  children: React.ReactNode
}

export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  ToolbarButtonProps
>(function ToolbarButton(
  {
    tooltip,
    tooltipSide = "top",
    active,
    destructive,
    className,
    children,
    disabled,
    ...rest
  },
  ref
) {
  const button = (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-pressed={active}
      data-state={active ? "active" : undefined}
      className={cn(
        iconBtnClass,
        active && "bg-accent text-foreground",
        destructive && "text-red-500 hover:text-red-500",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
  if (!tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  )
})

export type ToolbarPopoverTriggerRender = (state: {
  open: boolean
}) => React.ReactElement

export function ToolbarPopover({
  tooltip,
  tooltipSide = "top",
  contentClassName,
  side = "top",
  align = "center",
  sideOffset = 10,
  open: controlledOpen,
  onOpenChange,
  trigger,
  children,
}: {
  tooltip?: React.ReactNode
  tooltipSide?: Side
  contentClassName?: string
  side?: Side
  align?: Align
  sideOffset?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger: ToolbarPopoverTriggerRender
  children: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange]
  )

  const triggerNode = trigger({ open })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{triggerNode}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{triggerNode}</PopoverTrigger>
      )}
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(popoverContentClass, contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function ToolbarDragHandle({
  ariaLabel,
  rounded = "full",
  cursor = "grab",
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  ariaLabel: string
  rounded?: "full" | "md"
  cursor?: "grab" | "move"
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <ToolbarButton
      aria-label={ariaLabel}
      tooltip="Drag to move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        rounded === "full"
          ? "rounded-full border border-border/60"
          : undefined,
        cursor === "grab"
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-move active:cursor-grabbing"
      )}
    >
      <RiDragMove2Line className="size-4" />
    </ToolbarButton>
  )
}

export function ToolbarDeleteButton({
  ariaLabel,
  onDelete,
}: {
  ariaLabel: string
  onDelete: () => void
}) {
  return (
    <ToolbarButton
      aria-label={ariaLabel}
      tooltip="Delete"
      destructive
      onClick={onDelete}
    >
      <RiDeleteBinLine className="size-4" />
    </ToolbarButton>
  )
}

export function ToolbarDuplicateButton({
  ariaLabel,
  onDuplicate,
}: {
  ariaLabel: string
  onDuplicate: () => void
}) {
  return (
    <ToolbarButton
      aria-label={ariaLabel}
      tooltip="Duplicate"
      onClick={onDuplicate}
    >
      <RiFileCopyLine className="size-4" />
    </ToolbarButton>
  )
}

export function ToolbarLayerOrderMenu({
  onBringToFront,
  onSendToBack,
  extraItems,
  contentClassName = "w-44 p-1",
  align = "end",
}: {
  onBringToFront: () => void
  onSendToBack: () => void
  extraItems?: (close: () => void) => React.ReactNode
  contentClassName?: string
  align?: Align
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <ToolbarPopover
      tooltip="More options"
      contentClassName={contentClassName}
      align={align}
      open={open}
      onOpenChange={setOpen}
      trigger={({ open: triggerOpen }) => (
        <ToolbarButton aria-label="More options" active={triggerOpen}>
          <RiMoreFill className="size-4" />
        </ToolbarButton>
      )}
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => {
            onBringToFront()
            setOpen(false)
          }}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <RiBringToFront className="size-4" />
          Bring to front
        </button>
        <button
          type="button"
          onClick={() => {
            onSendToBack()
            setOpen(false)
          }}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <RiSendToBack className="size-4" />
          Send to back
        </button>
        {extraItems?.(() => setOpen(false))}
      </div>
    </ToolbarPopover>
  )
}

