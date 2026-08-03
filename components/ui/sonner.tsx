"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  RiCheckboxCircleLine,
  RiInformationLine,
  RiErrorWarningLine,
  RiCloseCircleLine,
  RiLoaderLine,
} from "@remixicon/react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Below 600px sonner sizes the toaster `width: 100%` while also setting
      // left/right offsets, so the container overhangs the right edge and
      // anything centred inside it lands off-centre. `w-auto` lets the offsets
      // define the box.
      className="toaster group max-[600px]:!w-auto"
      icons={{
        success: <RiCheckboxCircleLine className="size-4" />,
        info: <RiInformationLine className="size-4" />,
        warning: <RiErrorWarningLine className="size-4" />,
        error: <RiCloseCircleLine className="size-4" />,
        loading: <RiLoaderLine className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast group !flex !items-center gap-3 !py-3 !px-4 !min-h-0 !w-fit !max-w-[min(22rem,calc(100vw-2rem))] !left-0 !right-0 mx-auto",
          title: "text-[13px] font-medium text-left leading-snug text-pretty",
          content: "flex flex-col items-start justify-center min-w-0",
          icon: "m-0 shrink-0",
          // Sonner colours `[data-description]` from its own gray scale, which
          // stays dark on the destructive fill, so it needs overriding too.
          error:
            "!bg-destructive !text-white !border-destructive [&_[data-icon]]:!text-white [&_[data-description]]:!text-white/85",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
