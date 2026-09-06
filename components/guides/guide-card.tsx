import Link from "next/link"

import { formatGuideDate, type Guide } from "@/lib/guides"

import { GuideCoverSmall } from "./guide-cover"

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background ring-2 ring-background">
      {initials}
    </span>
  )
}

function StackedAvatars({ authors }: { authors: Guide["authors"] }) {
  return (
    <span className="flex -space-x-1.5">
      {authors.slice(0, 3).map((author) => (
        <Avatar key={author.name} name={author.name} />
      ))}
    </span>
  )
}

export function FeaturedGuideCard({ guide }: { guide: Guide }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group grid gap-6 lg:grid-cols-[1.35fr_0.9fr] lg:gap-8 xl:gap-10"
    >
      <div className="min-w-0 py-1">
        <div className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
          {formatGuideDate(guide.date)} · {guide.readingTime} · {guide.category}
        </div>
        <h2 className="mt-3 text-[22px] leading-[1.22] font-medium tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-[26px] lg:text-[28px]">
          {guide.title}
        </h2>
        <p className="mt-3 max-w-[52ch] text-sm leading-7 text-foreground/58 sm:text-[15px]">
          {guide.excerpt}
        </p>
        <div className="mt-5 flex items-center gap-2.5">
          <StackedAvatars authors={guide.authors} />
          <span className="text-sm text-foreground/70">
            {guide.authors.map((author) => author.name).join(", ")}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-border/50 transition group-hover:border-primary/20">
          <GuideCoverSmall
            cover={guide.cover}
            slug={guide.slug}
            title={guide.title}
            category={guide.category}
          />
        </div>
      </div>
    </Link>
  )
}

export function GuideGridCard({ guide }: { guide: Guide }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="group flex flex-col">
      <div className="font-mono text-[10px] tracking-widest text-foreground/40 uppercase">
        {formatGuideDate(guide.date)} · {guide.readingTime}
      </div>
      <h3 className="mt-3 line-clamp-3 text-[18px] leading-[1.3] font-medium tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-[19px]">
        {guide.title}
      </h3>
      <p className="mt-3 line-clamp-3 text-sm leading-7 text-foreground/58">
        {guide.excerpt}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <StackedAvatars authors={guide.authors} />
        <span className="text-sm text-foreground/70">
          {guide.authors[0]?.name}
          {guide.authors.length > 1 ? ` +${guide.authors.length - 1}` : ""}
        </span>
      </div>
    </Link>
  )
}
