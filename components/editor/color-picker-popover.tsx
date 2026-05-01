"use client"

import * as React from "react"
import Color from "color"

import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerSelection,
} from "@/components/kibo-ui/color-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Props = {
  value?: string
  onChange: (hex: string) => void
  children: React.ReactNode
  footer?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

export function ColorPickerPopover({
  value,
  onChange,
  children,
  footer,
  side = "left",
  align = "start",
}: Props) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-[260px] bg-popover/95 p-3 backdrop-blur-md"
      >
        {open ? (
          <>
            <PickerBody initial={value || "#000000"} onChange={onChange} />
            {footer}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function PickerBody({
  initial,
  onChange,
}: {
  initial: string
  onChange: (hex: string) => void
}) {
  // Keep latest onChange in a ref so the callback handed to kibo-ui has a
  // stable identity (its internal useEffect depends on onChange — a changing
  // identity re-fires it on every parent render and loops).
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  })

  // Skip the initial onChange fire that kibo-ui's useEffect dispatches on
  // mount — otherwise we'd push state back into the parent and re-render.
  const firstRef = React.useRef(true)

  const stableOnChange = React.useCallback((rgba: unknown) => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    const [r, g, b, a] = rgba as number[]
    try {
      const c = Color.rgb(r, g, b).alpha(a)
      const hex = a < 1 ? c.hexa() : c.hex()
      onChangeRef.current(hex)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <ColorPicker
      defaultValue={initial}
      onChange={stableOnChange}
      className="gap-3"
    >
      <ColorPickerSelection className="h-36" />
      <div className="flex items-center gap-2">
        <ColorPickerEyeDropper className="size-8" />
        <div className="flex flex-1 flex-col gap-1.5">
          <ColorPickerHue />
          <ColorPickerAlpha />
        </div>
      </div>
      <ColorPickerFormat />
    </ColorPicker>
  )
}
