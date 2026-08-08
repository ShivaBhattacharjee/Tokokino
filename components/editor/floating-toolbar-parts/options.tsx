import * as React from "react"

export const FIT_OPTIONS: {
  value: "contain" | "cover" | "fill"
  label: string
  icon: React.ReactNode
}[] = [
  {
    value: "contain",
    label: "Contain",
    icon: (
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          className="stroke-current opacity-30"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <rect
          x="7"
          y="5"
          width="18"
          height="22"
          rx="2"
          className="fill-current opacity-25"
        />
        <rect
          x="7"
          y="5"
          width="18"
          height="22"
          rx="2"
          className="stroke-current"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    value: "cover",
    label: "Cover",
    icon: (
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          className="stroke-current opacity-30"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          className="fill-current opacity-25"
        />
        <rect
          x="-2"
          y="4"
          width="36"
          height="24"
          rx="2"
          className="stroke-current"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    value: "fill",
    label: "Fill",
    icon: (
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          className="fill-current opacity-25"
        />
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          className="stroke-current"
          strokeWidth="1.5"
        />
        <path
          d="M8 8L5 5M24 8l3-3M8 24l-3 3M24 24l3 3"
          className="stroke-current opacity-50"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]
