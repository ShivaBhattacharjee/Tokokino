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

/**
 * Corner geometry for every glass rect. A plain circular border-radius jumps
 * from zero curvature to 1/r the instant the straight edge ends, which reads as
 * a kink once the panel is exported at 4K and zoomed. `corner-shape` keeps the
 * curvature continuous through that join; browsers without it drop the
 * declaration and keep the circular arc.
 */
export function glassCornerStyle(radiusCqw: number): CSSProperties {
  return {
    borderRadius: `${radiusCqw}cqw`,
    ...({
      cornerShape: "var(--theme-corner-shape, superellipse(1.3))",
    } as CSSProperties),
  }
}
