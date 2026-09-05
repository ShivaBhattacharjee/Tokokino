/** Quiet outlines borrowed from the canvas and animation timeline. */
export function NotFoundBackground() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 390 820"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-foreground opacity-[0.22] md:hidden dark:opacity-[0.13]"
      >
        <BackgroundMarks mobile />
      </svg>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full text-foreground opacity-[0.22] md:block dark:opacity-[0.13]"
      >
        <BackgroundMarks />
      </svg>
    </>
  )
}

function BackgroundMarks({ mobile = false }: { mobile?: boolean }) {
  const artboardTransform = mobile
    ? "translate(-16 54) rotate(-12 145 90) scale(.78)"
    : "translate(80 60) rotate(-12 145 90)"
  const curveTransform = mobile
    ? "translate(210 88) scale(.56)"
    : "translate(1020 65)"
  const timelineTransform = mobile
    ? "translate(198 666) rotate(-6 220 70) scale(.58)"
    : "translate(885 735) rotate(-6 220 70)"
  const cropTransform = mobile
    ? "translate(22 650) rotate(8 115 65) scale(.68)"
    : "translate(140 725) rotate(8 115 65)"

  return (
    <>
      {/* An artboard with selection handles and a slightly offset layer. */}
      <g transform={artboardTransform}>
        <rect x="22" y="22" width="290" height="170" rx="5" opacity="0.55" />
        <rect width="290" height="170" rx="2" />
        <path d="M145 0V-22M0 85H290" strokeDasharray="3 7" opacity="0.5" />
        <circle cx="145" cy="-26" r="4" className="stroke-primary" />
        {[
          [0, 0],
          [145, 0],
          [290, 0],
          [0, 170],
          [145, 170],
          [290, 170],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x - 3}
            y={y - 3}
            width="6"
            height="6"
            className="fill-background stroke-primary"
          />
        ))}
      </g>

      {/* A vector curve with its control points. */}
      <g transform={curveTransform}>
        <path d="M0 160C85 160 180 0 285 0" className="stroke-primary" />
        <path d="M0 160H85M180 0H285" opacity="0.65" />
        <circle cx="85" cy="160" r="4" className="stroke-primary" />
        <circle cx="180" cy="0" r="4" className="stroke-primary" />
        <rect
          x="-4"
          y="156"
          width="8"
          height="8"
          className="fill-background stroke-primary"
        />
        <rect
          x="281"
          y="-4"
          width="8"
          height="8"
          className="fill-background stroke-primary"
        />
      </g>

      {/* Staggered clips, keyframes, and a playhead on a timeline. */}
      <g transform={timelineTransform}>
        <path d="M0 0H500M0 44H500M0 88H500M0 132H500" opacity="0.55" />
        {Array.from({ length: 26 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 20} 0v${i % 5 === 0 ? 12 : 6}`}
            opacity="0.65"
          />
        ))}
        <rect x="20" y="23" width="180" height="32" rx="5" />
        <rect x="208" y="23" width="152" height="32" rx="5" />
        <rect
          x="94"
          y="67"
          width="225"
          height="32"
          rx="5"
          className="fill-primary/10 stroke-primary"
        />
        <path
          d="m130 77 6 6-6 6-6-6ZM280 77l6 6-6 6-6-6Z"
          className="fill-primary/25 stroke-primary"
        />
        <path d="M244 12V132" className="stroke-primary" />
        <path d="m239 5 5 7 5-7Z" className="fill-primary stroke-primary" />
      </g>

      {/* Cropping guides around a small video frame. */}
      <g transform={cropTransform}>
        <path
          d="M0 26V0H26M204 0H230V26M230 104V130H204M26 130H0V104"
          className="stroke-primary"
        />
        <rect x="10" y="10" width="210" height="110" rx="3" opacity="0.55" />
        <path
          d="m104 49 26 16-26 16Z"
          className="fill-primary/15 stroke-primary"
        />
      </g>
    </>
  )
}
