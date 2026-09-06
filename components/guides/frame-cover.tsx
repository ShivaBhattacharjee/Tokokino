"use client"

import { useEffect, useRef, useState } from "react"
import { FrameDrawing } from "./frame-illustration"
import styles from "./frame-cover.module.css"

export function FrameCover({ controls = true }: { controls?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting)
    )
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={root}
      className={styles.cover}
      data-paused={paused || !visible}
      data-preview={!controls}
    >
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.art}>
        <FrameDrawing step={0} />
      </div>
      <div className={styles.label}>
        <span>FRAME / FORMAT</span>
        <span>One screen. Many compositions.</span>
      </div>
      {controls && (
        <button
          type="button"
          className={styles.pause}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setPaused((value) => !value)
          }}
          aria-label={paused ? "Play cover animation" : "Pause cover animation"}
        >
          {paused ? "Play" : "Pause"}
        </button>
      )}
    </div>
  )
}
