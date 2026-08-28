import {
  RAIL_H_LEFT_STYLE,
  RAIL_H_RIGHT_STYLE,
} from "@/components/landing/rail-styles"

export function DashedH() {
  return (
    <div
      aria-hidden
      className="relative flex h-px overflow-hidden"
      style={{
        width: "99.6vw",
        marginLeft: "calc(50% - 49.8vw)",
      }}
    >
      <span className="h-px min-w-0 flex-1" style={RAIL_H_LEFT_STYLE} />
      <span className="h-px min-w-0 flex-1" style={RAIL_H_RIGHT_STYLE} />
    </div>
  )
}
