import { RAIL_H_STYLE } from "@/components/landing/rail-styles"

export function DashedH() {
  return (
    <div
      aria-hidden
      className="relative h-px"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", ...RAIL_H_STYLE }}
    />
  )
}
