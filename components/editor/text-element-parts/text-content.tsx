"use client"

import * as React from "react"

import type { TextElement } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { textContentStyle } from "./text-styles"

export function EditableTextContent({
  text,
  editorRef,
  showBorder,
  borderStyle,
  borderWidth,
  borderColor,
  commitContent,
}: {
  text: TextElement
  editorRef: React.RefObject<HTMLDivElement | null>
  showBorder: string | boolean | null
  borderStyle: string
  borderWidth: number
  borderColor: string
  commitContent: () => void
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={editorRef}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      onBlur={commitContent}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape") {
          e.preventDefault()
          commitContent()
        } else if (e.key === "Enter") {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            commitContent()
          }
        }
      }}
      className={cn(
        "cursor-text px-2 py-1 break-words whitespace-pre-wrap outline-none",
        showBorder && "rounded-md"
      )}
      style={textContentStyle({ text, borderStyle, borderWidth, borderColor })}
    />
  )
}

export function StaticTextContent({
  text,
  textViewRef,
  showBorder,
  borderStyle,
  borderWidth,
  borderColor,
  isSelected,
}: {
  text: TextElement
  textViewRef: React.RefObject<HTMLDivElement | null>
  showBorder: string | boolean | null
  borderStyle: string
  borderWidth: number
  borderColor: string
  isSelected: boolean
}) {
  return (
    <div
      ref={textViewRef}
      className={cn(
        "px-2 py-1 break-words whitespace-pre-wrap",
        showBorder && "rounded-md"
      )}
      data-selection-border={
        !text.borderColor && isSelected ? "true" : undefined
      }
      style={textContentStyle({ text, borderStyle, borderWidth, borderColor })}
    >
      {text.content}
    </div>
  )
}
