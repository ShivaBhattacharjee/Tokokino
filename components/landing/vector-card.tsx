import type { ReactNode } from "react"

export function VectorCard({
  vector,
  title,
  body,
  meta,
}: {
  vector: ReactNode
  title: string
  body: string
  meta?: string
}) {
  return (
    <div className="h-full rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm transition-colors hover:border-border/90">
      <div className="flex h-full flex-col rounded-[8px] border border-border/40 bg-background/60 p-5">
        <div className="flex h-[8.5rem] shrink-0 items-center justify-center">
          <div className="aspect-square h-full">{vector}</div>
        </div>
        <div className="mt-6 flex flex-col gap-1.5">
          {meta ? (
            <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/36 uppercase">
              {meta}
            </span>
          ) : null}
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="text-[12.5px] leading-5 text-foreground/52">{body}</p>
        </div>
      </div>
    </div>
  )
}
