import type { CSSProperties } from "react"

export function glassBackdropStyle(value: string): CSSProperties {
  return {
    backdropFilter: value,
    WebkitBackdropFilter: value,
  }
}

export function glassScreenClipStyle(): CSSProperties {
  return {
    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
  }
}
