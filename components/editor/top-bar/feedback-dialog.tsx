"use client"

import * as React from "react"
import { RiFeedbackLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogContent,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Five faces, low → high. `rating` sent to the API is the 1-based index. */
const FACES = [
  { emoji: "🤬", label: "Angry" },
  { emoji: "😐", label: "Meh" },
  { emoji: "😏", label: "Okay" },
  { emoji: "😎", label: "Good" },
  { emoji: "😍", label: "Love it" },
] as const

export function FeedbackDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerClassName,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Applied to the icon trigger — use to hide it on mobile. */
  triggerClassName?: string
} = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
  const [rating, setRating] = React.useState<number | null>(null)
  const [message, setMessage] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const reset = React.useCallback(() => {
    setRating(null)
    setMessage("")
    setSubmitting(false)
  }, [])

  const canSubmit =
    (rating !== null || message.trim().length > 0) && !submitting

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: rating !== null ? rating + 1 : undefined,
          message: message.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      toast.success("Thanks for the feedback!")
      setOpen(false)
      reset()
    } catch {
      toast.error("Couldn't send feedback. Please try again.")
      setSubmitting(false)
    }
  }, [canSubmit, rating, message, reset, setOpen])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Send feedback"
            onClick={() => setOpen(true)}
            className={cn(
              "focus-visible:ring-0 focus-visible:outline-none",
              triggerClassName
            )}
          >
            <RiFeedbackLine />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Send feedback</TooltipContent>
      </Tooltip>

      <DialogContent className="gap-5 p-5 sm:max-w-[420px]">
        <div className="space-y-0.5 pr-8">
          <DialogTitle className="text-base font-semibold">
            Send feedback,
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            We read them all!
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between gap-2">
          {FACES.map((face, index) => {
            const active = rating === index
            return (
              <button
                key={face.label}
                type="button"
                title={face.label}
                aria-label={face.label}
                aria-pressed={active}
                onClick={() => setRating(active ? null : index)}
                className={cn(
                  "flex size-14 items-center justify-center rounded-full text-2xl transition-all",
                  "bg-secondary/60 ring-1 ring-border/50 hover:bg-secondary",
                  "cursor-pointer select-none",
                  active
                    ? "scale-105 bg-secondary ring-2 ring-primary"
                    : "opacity-70 hover:opacity-100"
                )}
              >
                {face.emoji}
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="feedback-message"
            className="block text-sm font-semibold text-foreground"
          >
            How can we improve your experience?
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your feedback..."
            maxLength={2000}
            rows={5}
            className="w-full resize-none rounded-lg bg-secondary/50 px-3 py-2.5 text-base text-foreground ring-1 ring-border/50 transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Sending…" : "Send Feedback"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
