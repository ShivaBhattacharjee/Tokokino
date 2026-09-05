"use client"
import React, { useRef, useEffect, useState } from "react"
import { motion } from "motion/react"

// Helvetica Bold outlines for "Tokokino", fitted to the 300x100 viewBox. Baked to
// paths because WebKit measures stroke-dasharray on <text> in font units, so no
// dash length draws a glyph the same way it does in Blink.
const WORDMARK =
  "M44.75 23.58V32.76H30.47V75.4H20.42V32.76H6.07V23.58ZM74.4 41.93Q78.87 48.01 78.87 56.31Q78.87 64.75 74.4 70.74Q69.93 76.74 60.82 76.74Q51.72 76.74 47.25 70.74Q42.78 64.75 42.78 56.31Q42.78 48.01 47.25 41.93Q51.72 35.85 60.82 35.85Q69.93 35.85 74.4 41.93ZM60.79 44.32Q56.74 44.32 54.55 47.43Q52.37 50.54 52.37 56.31Q52.37 62.08 54.55 65.21Q56.74 68.33 60.79 68.33Q64.84 68.33 67.01 65.21Q69.18 62.08 69.18 56.31Q69.18 50.54 67.01 47.43Q64.84 44.32 60.79 44.32ZM117.88 75.4H106.73L98.28 59.02L94.45 63.34V75.4H85.38V23.76H94.45V51.67L105.95 37.26H117.39L105.05 51.92ZM151.83 41.93Q156.3 48.01 156.3 56.31Q156.3 64.75 151.83 70.74Q147.36 76.74 138.26 76.74Q129.15 76.74 124.68 70.74Q120.21 64.75 120.21 56.31Q120.21 48.01 124.68 41.93Q129.15 35.85 138.26 35.85Q147.36 35.85 151.83 41.93ZM138.22 44.32Q134.17 44.32 131.99 47.43Q129.8 50.54 129.8 56.31Q129.8 62.08 131.99 65.21Q134.17 68.33 138.22 68.33Q142.27 68.33 144.44 65.21Q146.61 62.08 146.61 56.31Q146.61 50.54 144.44 47.43Q142.27 44.32 138.22 44.32ZM195.31 75.4H184.16L175.71 59.02L171.89 63.34V75.4H162.81V23.76H171.89V51.67L183.39 37.26H194.82L182.48 51.92ZM209.31 37.08V75.4H199.94V37.08ZM209.31 23.26V32.51H199.94V23.26ZM234.87 44.5Q230.17 44.5 228.42 48.82Q227.51 51.11 227.51 54.66V75.4H218.31V37.15H227.22V42.74Q229 39.79 230.59 38.49Q233.44 36.17 237.82 36.17Q243.29 36.17 246.77 39.28Q250.26 42.39 250.26 49.6V75.4H240.8V52.09Q240.8 49.07 240.05 47.45Q238.69 44.5 234.87 44.5ZM288.23 41.93Q292.7 48.01 292.7 56.31Q292.7 64.75 288.23 70.74Q283.76 76.74 274.65 76.74Q265.55 76.74 261.08 70.74Q256.61 64.75 256.61 56.31Q256.61 48.01 261.08 41.93Q265.55 35.85 274.65 35.85Q283.76 35.85 288.23 41.93ZM274.62 44.32Q270.57 44.32 268.38 47.43Q266.2 50.54 266.2 56.31Q266.2 62.08 268.38 65.21Q270.57 68.33 274.62 68.33Q278.67 68.33 280.84 65.21Q283.01 62.08 283.01 56.31Q283.01 50.54 280.84 47.43Q278.67 44.32 274.62 44.32Z"

// Longest subpath in WORDMARK; every letter traces at this speed and the longest
// land on the final frame.
const TRACE_LENGTH = 224

export const TextHoverEffect = ({
  text,
  duration,
}: {
  text: string
  duration?: number
  automatic?: boolean
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" })

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect()
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      })
    }
  }, [cursor])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
    >
      <title>{text}</title>
      <defs>
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="25%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="75%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>
      <path
        d={WORDMARK}
        fill="none"
        strokeWidth="0.3"
        className="stroke-neutral-200 dark:stroke-neutral-800"
        style={{ opacity: hovered ? 0.7 : 0 }}
      />
      <motion.path
        d={WORDMARK}
        fill="none"
        strokeWidth="0.3"
        className="stroke-neutral-200 dark:stroke-neutral-800"
        initial={{ strokeDashoffset: TRACE_LENGTH }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 4, ease: "easeInOut" }}
        style={{ strokeDasharray: TRACE_LENGTH }}
      />
      <path
        d={WORDMARK}
        fill="none"
        stroke="url(#textGradient)"
        strokeWidth="0.3"
        mask="url(#textMask)"
      />
    </svg>
  )
}
