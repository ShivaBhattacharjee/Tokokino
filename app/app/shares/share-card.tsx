"use client"

import * as React from "react"
import {
  RiArrowRightUpLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEyeLine,
  RiFilmLine,
  RiLinkM,
  RiLoader4Line,
} from "@remixicon/react"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"

import {
  formatBytes,
  formatCount,
  formatDate,
  type SerializedShare,
} from "./shares-data"

export function ShareCard({
  share,
  downloading,
  onCopyLink,
  onDownload,
  onDelete,
}: {
  share: SerializedShare
  downloading: boolean
  onCopyLink: (id: string) => void
  onDownload: (id: string) => void
  onDelete: (id: string) => void
}) {
  const isAnimate = (share.type ?? "style") === "animate"
  const isVideo = (share.contentType ?? "").startsWith("video/")

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md bg-card/50 transition-colors duration-200 hover:bg-card">
      <a
        href={`/share/${share.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block overflow-hidden rounded-t-md bg-secondary/30"
      >
        {isAnimate ? (
          <span className="absolute top-2.5 left-2.5 z-[2] inline-flex items-center gap-1 rounded-[4px] border border-white/15 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
            <RiFilmLine className="size-3 text-primary" />
            Animate
          </span>
        ) : null}

        {isVideo ? (
          share.posterUrl ? (
            <ShimmerImage
              src={share.posterUrl}
              alt="Shared animation poster"
              className="aspect-video w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-secondary/50">
              <RiFilmLine className="size-9 text-muted-foreground/50" />
            </div>
          )
        ) : (
          <ShimmerImage
            src={share.imageUrl}
            alt="Shared media"
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        )}

        {/* hover affordance */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-background/85 text-foreground shadow-lg backdrop-blur-sm">
            <RiArrowRightUpLine className="size-5" />
          </span>
        </div>
      </a>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <RiEyeLine className="size-4 shrink-0 text-muted-foreground" />
            <span className="tabular">{formatCount(share.viewCount)}</span>{" "}
            {share.viewCount === 1 ? "view" : "views"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatDate(share.createdAt)}
            {share.sizeBytes > 0 && <> · {formatBytes(share.sizeBytes)}</>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconAction label="Copy link" onClick={() => onCopyLink(share.id)}>
            <RiLinkM className="size-4" />
          </IconAction>
          <IconAction
            label={downloading ? "Downloading…" : "Download"}
            disabled={downloading}
            onClick={() => onDownload(share.id)}
          >
            {downloading ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiDownloadLine className="size-4" />
            )}
          </IconAction>
          <IconAction
            label="Delete"
            destructive
            onClick={() => onDelete(share.id)}
          >
            <RiDeleteBinLine className="size-4" />
          </IconAction>
        </div>
      </div>

      {/* Border ring drawn above the image so hover shows all around */}
      <div className="pointer-events-none absolute inset-0 z-[3] rounded-md ring-1 ring-border/60 transition-colors duration-200 ring-inset group-hover:ring-primary/50" />
    </article>
  )
}

function IconAction({
  label,
  onClick,
  destructive,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-60",
        destructive
          ? "hover:bg-destructive/15 hover:text-destructive"
          : "hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
