"use client"

import * as React from "react"

import { parseEditorNumber } from "@/lib/editor/value-schemas"
import { cn } from "@/lib/utils"

type Props = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  className?: string
}

export function EditableValue({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix = "",
  className,
}: Props) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(String(value))
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setText(String(value))
  }, [value, editing])

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    if (text.trim() !== "") {
      const parsed = parseEditorNumber(text, min, max)
      if (parsed !== null) onChange(parsed)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          else if (e.key === "Escape") {
            setText(String(value))
            setEditing(false)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            const n = Number(text) || 0
            const next = parseEditorNumber(n + step, min, max)
            if (next !== null) setText(String(next))
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            const n = Number(text) || 0
            const next = parseEditorNumber(n - step, min, max)
            if (next !== null) setText(String(next))
          }
        }}
        inputMode="numeric"
        className={cn(
          "tabular h-5 w-14 rounded bg-secondary/60 px-1 text-right font-mono text-[11px] text-foreground outline-none ring-1 ring-foreground/30",
          className
        )}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "tabular cursor-text rounded px-1 font-mono text-[11px] text-foreground/80 hover:bg-secondary/50 hover:text-foreground",
        className
      )}
      title="Click to edit"
    >
      {value}
      {suffix}
    </button>
  )
}
