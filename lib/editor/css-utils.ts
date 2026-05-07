import type * as React from "react"

import { hexToRgb } from "./color-utils"
import type {
  AssetFilter,
  Background,
  BackdropEffects,
  EnhancePreset,
  Shadow,
} from "./state-types"

export function assetFilterCss(filter: AssetFilter): string | undefined {
  switch (filter) {
    case "bw":
      return "grayscale(1) contrast(1.05)"
    case "sepia":
      return "sepia(0.85) saturate(1.1)"
    case "vintage":
      return "sepia(0.4) contrast(0.95) saturate(0.9) hue-rotate(-10deg)"
    case "warm":
      return "saturate(1.15) hue-rotate(-12deg) brightness(1.04)"
    case "cool":
      return "saturate(1.1) hue-rotate(15deg) brightness(1.02)"
    case "fade":
      return "contrast(0.85) brightness(1.08) saturate(0.85)"
    case "vivid":
      return "saturate(1.5) contrast(1.15)"
    case "noir":
      return "grayscale(1) contrast(1.35) brightness(0.9)"
    case "dream":
      return "blur(0.5px) saturate(1.2) brightness(1.05) contrast(0.95)"
    case "mono":
      return "grayscale(1) sepia(0.3) contrast(1.05)"
    case "invert":
      return "invert(1) hue-rotate(180deg)"
    case "none":
    default:
      return undefined
  }
}

export function patternCssFor(
  id: number,
  color: string,
  thickness: number
): React.CSSProperties {
  const t = Math.max(0.5, thickness)
  switch (id) {
    case 1:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "10px 10px",
      }
    case 2:
      return {
        backgroundImage: `linear-gradient(${color} ${t}px, transparent ${t}px), linear-gradient(90deg, ${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "14px 14px",
      }
    case 3:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 8px)`,
      }
    case 4:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px), radial-gradient(${color} ${Math.max(
          0.5,
          t - 0.3
        )}px, transparent ${Math.max(0.5, t - 0.3)}px)`,
        backgroundSize: "9px 9px, 13px 13px",
        backgroundPosition: "0 0, 4px 4px",
      }
    case 5:
      return {
        backgroundImage: `conic-gradient(from 180deg at 50% 50%, ${color}, transparent, ${color})`,
      }
    case 6:
      return {
        backgroundImage: `linear-gradient(30deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%), linear-gradient(150deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%)`,
        backgroundSize: "60px 100px",
      }
    case 7:
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 ${t}px, transparent ${t}px 10px), repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 8:
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 9:
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 10: {
      const r = Math.max(3, 5 - t / 2)
      return {
        backgroundImage: `radial-gradient(circle, transparent ${r}px, ${color} ${r}px ${r + t}px, transparent ${r + t}px)`,
        backgroundSize: "20px 20px",
      }
    }
    case 11:
      return {
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%)`,
        backgroundSize: "16px 16px",
        backgroundPosition: "-8px 0, -8px 0, 0 0, 0 0",
      }
    case 12:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t * 3}px, transparent ${t * 3}px ${t * 6}px)`,
      }
    default:
      return {}
  }
}

export function enhanceFilterCss(preset: EnhancePreset): string | undefined {
  switch (preset) {
    case "auto":
      return "brightness(1.04) contrast(1.08) saturate(1.1)"
    case "vivid":
      return "brightness(1.05) contrast(1.12) saturate(1.35)"
    case "soft":
      return "brightness(1.06) contrast(0.96) saturate(0.9)"
    case "dramatic":
      return "brightness(0.98) contrast(1.25) saturate(1.2)"
    case "sharp":
      return "brightness(1.02) contrast(1.18) saturate(1.05)"
    case "off":
    default:
      return undefined
  }
}

export function effectsFilterCss(e: BackdropEffects): string | undefined {
  const parts: string[] = []
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`)
  if (e.brightness !== 100) parts.push(`brightness(${e.brightness}%)`)
  if (e.contrast !== 100) parts.push(`contrast(${e.contrast}%)`)
  if (e.saturation !== 100) parts.push(`saturate(${e.saturation}%)`)
  if (e.hue !== 0) parts.push(`hue-rotate(${e.hue}deg)`)
  if (e.grayscale > 0) parts.push(`grayscale(${e.grayscale}%)`)
  if (e.sepia > 0) parts.push(`sepia(${e.sepia}%)`)
  if (e.invert > 0) parts.push(`invert(${e.invert}%)`)
  if (e.opacity !== 100) parts.push(`opacity(${e.opacity}%)`)
  return parts.length ? parts.join(" ") : undefined
}

function shadowRgba(color: string, opacity: number): string {
  const { r, g, b } = hexToRgb(color || "#000000")
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`
}

export function shadowCss(shadow: Shadow): string | undefined {
  if (shadow.type === "none" || shadow.intensity <= 0) return undefined
  const intensity = shadow.intensity / 100
  const color = shadow.color || "#000000"

  if (shadow.type === "glow") {
    const blur = 30 + intensity * 90
    const spread = intensity * 8
    const opacity = 0.18 + intensity * 0.42
    return `0 0 ${blur}px ${spread}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "soft") {
    let dx = 0,
      dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) {
        dx = -(c - 2)
        dy = -(r - 2)
      }
    }
    const unit = intensity * 10
    const blur = 40 + intensity * 80
    const spread = intensity * 4
    const opacity = 0.1 + intensity * 0.2
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread.toFixed(1)}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "hard") {
    let dx = 0,
      dy = 0
    if (shadow.lightSource !== "center") {
      const [r, c] = shadow.lightSource.split("-").map(Number)
      if (Number.isFinite(r) && Number.isFinite(c)) {
        dx = -(c - 2)
        dy = -(r - 2)
      }
    }
    const unit = intensity * 12
    const opacity = 0.25 + intensity * 0.45
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px 0px 0px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "float") {
    const opacity1 = 0.12 + intensity * 0.18
    const opacity2 = 0.08 + intensity * 0.12
    const blur1 = 15 + intensity * 25
    const blur2 = 40 + intensity * 60
    const dy1 = 4 + intensity * 12
    const dy2 = 8 + intensity * 20
    return `0 ${dy1.toFixed(1)}px ${blur1.toFixed(1)}px 0px ${shadowRgba(color, opacity1)}, 0 ${dy2.toFixed(1)}px ${blur2.toFixed(1)}px 0px ${shadowRgba(color, opacity2)}`
  }

  let dx = 0,
    dy = 0
  if (shadow.lightSource !== "center") {
    const [r, c] = shadow.lightSource.split("-").map(Number)
    if (Number.isFinite(r) && Number.isFinite(c)) {
      dx = -(c - 2)
      dy = -(r - 2)
    }
  }
  const unit = intensity * 16
  const blur = 20 + intensity * 60
  const spread = -2
  const opacity = 0.15 + intensity * 0.35
  return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread}px ${shadowRgba(color, opacity)}`
}

export function backgroundCss(bg: Background): React.CSSProperties {
  if (bg.type === "none") return {}
  if (bg.type === "image") {
    return {
      backgroundImage: `url("${bg.value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  }
  return { background: bg.value }
}
