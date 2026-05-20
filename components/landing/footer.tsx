import { TextHoverEffect } from "@/components/ui/text-hover-effect"

export function Footer() {
  return (
    <footer className="relative w-full">
      <div className="h-32 w-full md:h-80">
        <TextHoverEffect text="Tokokino" duration={0.2} />
      </div>
    </footer>
  )
}
