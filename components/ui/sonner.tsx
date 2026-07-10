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
      className="toaster group"
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
            "cn-toast group !flex !items-center !justify-center gap-3 !py-3 !px-4 !min-h-0 !w-fit mx-auto",
          title: "text-[13px] font-medium text-center",
          content: "flex items-center justify-center",
          icon: "m-0",
          error:
            "!bg-destructive !text-white !border-destructive [&_[data-icon]]:!text-white",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
