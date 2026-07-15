import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * Centered brand mark + indeterminate progress bar shown on the canvas surface
 * while the editor mounts.
 *
 * Deliberately not a client component: the route-level `loading.tsx` renders on
 * the server before any JS lands, so the bar animates in CSS rather than motion.
 *
 * The bar is indeterminate by design — mounting reports no progress, so it
 * carries no `aria-valuenow` and must not imply a measured percentage.
 */
export function CanvasLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col items-center gap-6 select-none", className)}
    >
      <Image
        src="/logo.png"
        alt=""
        width={80}
        height={80}
        priority
        className="size-16 opacity-90"
      />
      <div
        role="progressbar"
        aria-label="Loading editor"
        // Caps at the container so it never overflows a narrow canvas surface.
        className="h-[3px] w-[min(320px,60cqw)] overflow-hidden rounded-full bg-foreground/15"
      >
        <div className="animate-indeterminate-sweep h-full w-1/4 rounded-full bg-foreground/70" />
      </div>
    </div>
  )
}
