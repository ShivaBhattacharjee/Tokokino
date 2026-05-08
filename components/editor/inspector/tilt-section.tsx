"use client"

import * as React from "react"

import { EditableValue } from "@/components/editor/editable-value"
import { Slider } from "@/components/ui/slider"
import { useEditor } from "@/lib/editor/store"

function DegreeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <EditableValue
          value={value}
          onChange={onChange}
          min={-180}
          max={180}
          suffix="°"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={-45}
        max={45}
        className="cursor-pointer"
      />
    </div>
  )
}

export function TiltSection() {
  const { tilt, setTilt, scale, setScale } = useEditor()
  return (
    <>
      <DegreeRow
        label="Rotate X"
        value={tilt.rx}
        onChange={(v) => setTilt({ ...tilt, rx: v })}
      />
      <DegreeRow
        label="Rotate Y"
        value={tilt.ry}
        onChange={(v) => setTilt({ ...tilt, ry: v })}
      />
      <DegreeRow
        label="Rotate Z"
        value={tilt.rz}
        onChange={(v) => setTilt({ ...tilt, rz: v })}
      />
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground">Scale</span>
        <EditableValue
          value={scale}
          onChange={setScale}
          min={10}
          max={300}
          suffix="%"
        />
      </div>
      <Slider
        value={[scale]}
        onValueChange={([v]) => setScale(v)}
        min={50}
        max={150}
        className="cursor-pointer"
      />
    </>
  )
}
