import Image from "next/image"

type Props = {
  slug: string
  title: string
  category: string
  cover?: string
  controls?: boolean
}

export function GuideCover({
  title,
  cover = "https://assets.tokokino.com/screenshot-v2.webp",
}: Props) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-transparent">
      <Image
        src={cover}
        alt={`Tokokino editor: ${title}`}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 800px"
        className="object-contain"
      />
    </div>
  )
}

export function GuideCoverSmall(props: Props) {
  return <GuideCover {...props} controls={false} />
}
