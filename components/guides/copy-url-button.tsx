"use client"

import { RiLink } from "@remixicon/react"
import { useState } from "react"

export function CopyUrlButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-foreground/40 uppercase transition-colors hover:text-primary"
    >
      <span
        aria-hidden
        className="inline-flex size-6 items-center justify-center rounded-full border border-foreground/10"
      >
        <RiLink className="size-3 text-foreground/40 transition-colors group-hover:text-primary" />
      </span>
      {copied ? "Copied" : "Copy URL"}
    </button>
  )
}
