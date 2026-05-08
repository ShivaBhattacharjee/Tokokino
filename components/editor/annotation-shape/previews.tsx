"use client"

import * as React from "react"

import {
  type AnnotationBlurEffect,
  type AnnotationLineStyle,
  type AnnotationShape,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { getBlurAmount, getBlurEffect, lineDashArray } from "./geometry"

export function LineStylePreview({
  style,
  kind,
  active,
}: {
  style: AnnotationLineStyle
  kind: AnnotationShape["kind"]
  active: boolean
}) {
  const strokeColor = active ? "text-foreground" : "text-foreground/55"
  const dashArray = lineDashArray(style)
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 overflow-visible", strokeColor)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "arrow" ? (
        <>
          <path d="m12 19-7-7 7-7" strokeDasharray={dashArray} />
          <path d="M19 12H5" strokeDasharray={dashArray} />
        </>
      ) : kind === "rect" ? (
        <rect
          x="3.5"
          y="3.5"
          width="13"
          height="13"
          rx="2.5"
          strokeDasharray={dashArray}
        />
      ) : (
        <circle cx="10" cy="10" r="6.5" strokeDasharray={dashArray} />
      )}
    </svg>
  )
}

export function RedactionTemplatePreview({
  effect,
  active,
}: {
  effect: AnnotationBlurEffect
  active: boolean
}) {
  const tone = active ? "bg-foreground" : "bg-foreground/55"

  if (effect === "blur") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border border-foreground/10 bg-foreground/35",
          active ? "opacity-100" : "opacity-70"
        )}
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.38), rgba(255,255,255,0.04))",
        }}
      />
    )
  }

  if (effect === "redact-stripe") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border-2 border-current",
          active ? "text-foreground" : "text-foreground/55"
        )}
        style={{
          background:
            "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px)",
        }}
      />
    )
  }

  if (effect === "pixelate") {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-[3px] border-2 border-current",
          active ? "text-foreground" : "text-foreground/55"
        )}
        style={{
          backgroundColor: "transparent",
          backgroundImage:
            "linear-gradient(45deg, currentColor 25%, transparent 25%), linear-gradient(-45deg, currentColor 25%, transparent 25%), linear-gradient(45deg, transparent 75%, currentColor 75%), linear-gradient(-45deg, transparent 75%, currentColor 75%)",
          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
          backgroundSize: "8px 8px",
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn("size-4 rounded-[3px] border border-foreground/10", tone)}
    />
  )
}

export function BlurRedactionShape({ shape }: { shape: AnnotationShape }) {
  const effect = getBlurEffect(shape)
  const amount = getBlurAmount(shape)

  if (effect === "redact") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[3px]"
        style={{
          backgroundColor: "#050505",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      />
    )
  }

  if (effect === "redact-light") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[3px] border border-black/10 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
      />
    )
  }

  if (effect === "redact-stripe") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[3px] bg-neutral-950"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 8px)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      />
    )
  }

  if (effect === "pixelate") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[3px] bg-black/70"
        style={{
          backdropFilter: "blur(2px) contrast(1.25)",
          WebkitBackdropFilter: "blur(2px) contrast(1.25)",
          backgroundImage:
            "linear-gradient(45deg, rgba(255,255,255,0.16) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.12) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.16) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.12) 75%)",
          backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
          backgroundSize: "12px 12px",
        }}
      />
    )
  }

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden rounded-[3px] border border-white/25 bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
      style={{
        backdropFilter: `blur(${amount}px) saturate(1.2)`,
        WebkitBackdropFilter: `blur(${amount}px) saturate(1.2)`,
      }}
    />
  )
}
