import type * as React from "react"

import type { TextElement } from "@/lib/editor/state-types"

export function textContentStyle({
  text,
  borderStyle,
  borderWidth,
  borderColor,
  fontSize = text.fontSize,
}: {
  text: TextElement
  borderStyle: string
  borderWidth: number
  borderColor: string
  fontSize?: number
}): React.CSSProperties {
  return {
    fontFamily: text.fontFamily,
    fontSize,
    fontWeight: text.fontWeight,
    letterSpacing: `${text.letterSpacing ?? 0}px`,
    color: text.color,
    textAlign: text.align,
    lineHeight: text.lineHeight ?? 1.3,
    borderStyle,
    borderWidth,
    borderColor,
    wordBreak: "break-word",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    ...(text.strokeColor && text.strokeWidth
      ? {
          WebkitTextStroke: `${text.strokeWidth}px ${text.strokeColor}`,
          paintOrder: "stroke fill",
        }
      : {}),
    ...(text.textShadow ? { textShadow: text.textShadow } : {}),
  }
}
