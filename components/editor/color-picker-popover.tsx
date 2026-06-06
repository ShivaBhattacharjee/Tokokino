"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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
  const isMobile = useIsMobileViewport()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {isMobile ? (
        open ? (
          createPortal(
            <div className="fixed inset-0 z-[1000]">
              <button
                type="button"
                aria-label="Close color picker"
                className="absolute inset-0 cursor-default bg-transparent"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                className="absolute top-[calc(64dvh-12px)] left-1/2 max-h-[min(430px,calc(100dvh-1rem))] w-[min(260px,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-popover/95 p-3 text-xs text-popover-foreground shadow-xl ring-1 ring-foreground/10 backdrop-blur-md"
              >
                <PickerBody initial={value || "#000000"} onChange={onChange} />
                {footer}
              </div>
            </div>,
            document.body
          )
        ) : null
      ) : (
        <PopoverContent
          side={side}
          align={align}
          collisionPadding={12}
          className="max-h-[min(430px,calc(100dvh-1rem))] w-[min(260px,calc(100vw-1rem))] overflow-y-auto bg-popover/95 p-3 backdrop-blur-md"
        >
          {open ? (
            <>
              <PickerBody initial={value || "#000000"} onChange={onChange} />
              {footer}
            </>
          ) : null}
        </PopoverContent>
      )}
    </Popover>
  )
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return isMobile
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
