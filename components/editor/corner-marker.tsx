import { cn } from "@/lib/utils"

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

const CORNER_POSITIONS: Record<Corner, string> = {
  "top-left": "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
  "top-right": "top-0 right-0 translate-x-1/2 -translate-y-1/2",
  "bottom-left": "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
  "bottom-right": "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
}

export function CornerMarker({
  corner,
  className,
  size = 10,
}: {
  corner: Corner
  className?: string
  size?: number
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      className={cn(
        "pointer-events-none absolute z-10 text-border",
        CORNER_POSITIONS[corner],
        className
      )}
    >
      <path
        d="M5 0V10M0 5H10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
      />
    </svg>
  )
}

/**
 * Renders a plus marker at each of the four corners of the nearest
 * positioned ancestor. Drop this inside a `relative` element.
 */
export function CornerMarkers({
  className,
  size,
}: {
  className?: string
  size?: number
}) {
  return (
    <>
      <CornerMarker corner="top-left" className={className} size={size} />
      <CornerMarker corner="top-right" className={className} size={size} />
      <CornerMarker corner="bottom-left" className={className} size={size} />
      <CornerMarker corner="bottom-right" className={className} size={size} />
    </>
  )
}
