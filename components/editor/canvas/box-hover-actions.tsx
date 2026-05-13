"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiCropLine, RiDeleteBinLine, RiRefreshLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

type BoxHoverActionsProps = {
  hoverGroupClass: string
  disabled?: boolean
  inline?: boolean
  layoutKey?: string | number
  controlScale?: number
  measureRef?: React.RefObject<HTMLElement | null>
  onCrop: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
}

export function BoxHoverActions({
  hoverGroupClass,
  disabled = false,
  inline = false,
  layoutKey,
  controlScale = 1,
  measureRef,
  onCrop,
  onReplaceFile,
  onDelete,
}: BoxHoverActionsProps) {
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const hideTimerRef = React.useRef<number | null>(null)
  const hoverTargetActiveRef = React.useRef(false)
  const controlsActiveRef = React.useRef(false)
  const [visible, setVisible] = React.useState(false)
  const [visibleLayoutKey, setVisibleLayoutKey] = React.useState<
    string | number | undefined
  >(undefined)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  const clearHideTimer = React.useCallback(() => {
    if (hideTimerRef.current === null) return
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  const scheduleHide = React.useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      if (!hoverTargetActiveRef.current && !controlsActiveRef.current) {
        setVisible(false)
      }
      hideTimerRef.current = null
    }, 180)
  }, [clearHideTimer])

  React.useEffect(() => {
    const anchor = anchorRef.current
    const hoverTarget =
      measureRef?.current ??
      anchor?.closest<HTMLElement>("[data-box-hover-target]") ??
      anchor?.parentElement
    if (!anchor || !hoverTarget) return

    const updateRect = () =>
      setRect((measureRef?.current ?? anchor).getBoundingClientRect())
    const show = () => {
      if (disabled) return
      hoverTargetActiveRef.current = true
      clearHideTimer()
      updateRect()
      setVisibleLayoutKey(layoutKey)
      setVisible(true)
    }
    const hideFromTarget = (event: PointerEvent | FocusEvent) => {
      const nextTarget = event.relatedTarget
      if (
        nextTarget instanceof Node &&
        controlsRef.current?.contains(nextTarget)
      ) {
        controlsActiveRef.current = true
        return
      }
      hoverTargetActiveRef.current = false
      scheduleHide()
    }

    hoverTarget.addEventListener("pointerenter", show)
    hoverTarget.addEventListener("pointermove", show)
    hoverTarget.addEventListener("pointerleave", hideFromTarget)
    hoverTarget.addEventListener("focusin", show)
    hoverTarget.addEventListener("focusout", hideFromTarget)
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    updateRect()

    return () => {
      clearHideTimer()
      hoverTarget.removeEventListener("pointerenter", show)
      hoverTarget.removeEventListener("pointermove", show)
      hoverTarget.removeEventListener("pointerleave", hideFromTarget)
      hoverTarget.removeEventListener("focusin", show)
      hoverTarget.removeEventListener("focusout", hideFromTarget)
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
    }
  }, [clearHideTimer, disabled, layoutKey, measureRef, scheduleHide])

  const controlsVisible =
    visible && !disabled && visibleLayoutKey === layoutKey
  const controls = (
    <>
      <BoxActionButton label="Crop image" onClick={onCrop}>
        <RiCropLine className="size-4" />
      </BoxActionButton>
      <BoxActionButton
        label="Replace image"
        onClick={() => replaceInputRef.current?.click()}
      >
        <RiRefreshLine className="size-4" />
      </BoxActionButton>
      <BoxActionButton label="Delete image" destructive onClick={onDelete}>
        <RiDeleteBinLine className="size-4" />
      </BoxActionButton>
    </>
  )

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 size-0 -translate-x-1/2 -translate-y-1/2 opacity-0",
          hoverGroupClass
        )}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onReplaceFile(file)
          e.target.value = ""
        }}
      />
      {inline ? (
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 z-[1100] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 opacity-0 transition-opacity duration-200",
            !disabled && hoverGroupClass
          )}
          style={{
            transform: `translate(-50%, -50%) scale(${controlScale})`,
            transformOrigin: "center",
          }}
        >
          {controls}
        </div>
      ) : null}
      {!inline && controlsVisible && rect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={controlsRef}
              className="pointer-events-auto fixed flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 transition-opacity duration-200"
              style={{
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width / 2,
                zIndex: 1100,
                transform: `translate(-50%, -50%) scale(${controlScale})`,
                transformOrigin: "center",
              }}
              onPointerEnter={() => {
                controlsActiveRef.current = true
                clearHideTimer()
                setVisible(true)
              }}
              onPointerLeave={(event) => {
                const nextTarget = event.relatedTarget
                controlsActiveRef.current = false
                if (
                  nextTarget instanceof Node &&
                  anchorRef.current
                    ?.closest<HTMLElement>("[data-box-hover-target]")
                    ?.contains(nextTarget)
                ) {
                  hoverTargetActiveRef.current = true
                  return
                }
                scheduleHide()
              }}
              onFocus={() => {
                controlsActiveRef.current = true
                clearHideTimer()
                setVisible(true)
              }}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget
                controlsActiveRef.current = false
                if (
                  nextTarget instanceof Node &&
                  anchorRef.current
                    ?.closest<HTMLElement>("[data-box-hover-target]")
                    ?.contains(nextTarget)
                ) {
                  hoverTargetActiveRef.current = true
                  return
                }
                scheduleHide()
              }}
            >
              {controls}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function BoxActionButton({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/85",
        destructive && "hover:bg-red-500/90"
      )}
    >
      {children}
    </button>
  )
}
