"use client"

import { Lens } from "@/components/ui/lens"
import type { TextElement } from "@/lib/editor/state-types"

import { RESIZE_LENS_PAD, RESIZE_LENS_SIZE } from "./constants"
import { textContentStyle } from "./text-styles"
import type { ResizeLensState } from "./types"

export function TextResizeLens({
  resizeLens,
  text,
  borderStyle,
  borderWidth,
  borderColor,
}: {
  resizeLens: ResizeLensState
  text: TextElement
  borderStyle: string
  borderWidth: number
  borderColor: string
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 md:hidden"
      style={{
        left: -RESIZE_LENS_PAD,
        top: -RESIZE_LENS_PAD,
        width: resizeLens.width + RESIZE_LENS_PAD * 2,
        height: resizeLens.height + RESIZE_LENS_PAD * 2,
      }}
    >
      <div
        className="absolute rounded-full border border-border/60 bg-background shadow-2xl"
        style={{
          left: resizeLens.x + RESIZE_LENS_PAD - RESIZE_LENS_SIZE / 2,
          top: resizeLens.y + RESIZE_LENS_PAD - RESIZE_LENS_SIZE / 2,
          width: RESIZE_LENS_SIZE,
          height: RESIZE_LENS_SIZE,
        }}
      />
      <Lens
        isStatic
        showBase={false}
        zoomFactor={1.75}
        lensSize={RESIZE_LENS_SIZE}
        lensColor="#ffffff"
        position={{
          x: resizeLens.x + RESIZE_LENS_PAD,
          y: resizeLens.y + RESIZE_LENS_PAD,
        }}
        className="h-full w-full rounded-none"
        ariaLabel="Text resize preview"
      >
        <div className="relative h-full w-full bg-background">
          <div
            className="absolute box-border px-2 py-1 break-words whitespace-pre-wrap"
            style={{
              ...textContentStyle({
                text,
                borderStyle,
                borderWidth,
                borderColor,
                fontSize: resizeLens.fontSize,
              }),
              left: RESIZE_LENS_PAD,
              top: RESIZE_LENS_PAD,
              width: resizeLens.width,
              height: resizeLens.height,
            }}
          >
            {text.content}
          </div>
        </div>
      </Lens>
    </div>
  )
}
