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
  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shrink-0 touch-manipulation"

export const popoverContentClass =
  "border-border/60 bg-popover/95 backdrop-blur-md"

export const toolbarSurfaceClass =
  "nodrag pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-md:max-w-[280px]"

export function bulkToolbarScale(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1
  return Math.max(0.5, Math.min(1, Math.sqrt(zoom)))
}

export function floatingToolbarTransform(flipBelow: boolean, scale = 1) {
  const placement = flipBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)"
  return scale === 1 ? placement : `${placement} scale(${scale})`
}

type Side = "top" | "bottom" | "left" | "right"
type Align = "start" | "center" | "end"

export function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px bg-border sm:mx-1 sm:h-5" />
}

export function ToolbarSurface({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      {...props}
      className={cn(toolbarSurfaceClass, className)}
      style={{ WebkitOverflowScrolling: "touch", ...props.style }}
      onPointerDown={(e) => {
        e.stopPropagation()
        props.onPointerDown?.(e)
      }}
      onPointerMove={(e) => {
        e.stopPropagation()
        props.onPointerMove?.(e)
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        props.onPointerUp?.(e)
      }}
      onPointerCancel={(e) => {
        e.stopPropagation()
        props.onPointerCancel?.(e)
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
      <div className="flex min-w-max items-center gap-0.5">{children}</div>
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
        disabled && "cursor-not-allowed opacity-40",
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
  collisionPadding = 8,
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
  collisionPadding?: number
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
        data-editor-toolbar-popover
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
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
        rounded === "full" ? "rounded-full border border-border/60" : undefined,
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
  const pointerDeletedRef = React.useRef(false)

  return (
    <ToolbarButton
      aria-label={ariaLabel}
      tooltip="Delete"
      destructive
      onPointerDown={(e) => {
        pointerDeletedRef.current = true
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (pointerDeletedRef.current) {
          pointerDeletedRef.current = false
          return
        }
        onDelete()
      }}
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
