"use client"

import * as React from "react"
import { RiRefreshLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EditorErrorBoundaryProps = {
  children: React.ReactNode
  label?: string
  className?: string
  resetKeys?: readonly unknown[]
}

type EditorErrorBoundaryState = {
  error: Error | null
}

function resetKeysChanged(
  prev: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined
) {
  if (!prev || !next) return false
  if (prev.length !== next.length) return true
  return prev.some((value, index) => !Object.is(value, next[index]))
}

export class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Editor surface crashed", error, info)
  }

  componentDidUpdate(prevProps: EditorErrorBoundaryProps) {
    if (
      this.state.error &&
      resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ error: null })
    }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { children, className, label = "Editor surface" } = this.props
    const { error } = this.state

    if (!error) return children

    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center bg-background p-4",
          className
        )}
      >
        <div className="flex max-w-sm flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1 font-mono text-[10px] tracking-widest uppercase">
            <span className="text-primary">500</span>
            <span className="text-foreground/45">Surface stopped</span>
          </span>
          <p className="mt-3 text-sm font-medium tracking-[-0.02em] text-foreground">
            {label} crashed
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/55">
            The rest of the editor is still running.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-4 gap-2 px-3"
            onClick={this.reset}
          >
            <RiRefreshLine className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    )
  }
}
