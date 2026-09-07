import { useId, type ReactNode } from "react"

const captions = [
  "One board for the whole set",
  "Grid, row, or column in one press",
  "Panels follow the active canvas",
  "Animate waits off the board",
  "Preview the row, export the set",
]

/** Isometric line drawings with transparent faces and theme-aware strokes. */
export function BulkIllustration({ step }: { step: number }) {
  const id = useId().replace(/:/g, "")
  const line = `url(#${id}-line)`
  const accent = `url(#${id}-accent)`
  const hatch = `url(#${id}-hatch)`

  // All front faces share the same projection; thickness extends up/right.
  function plate(
    x: number,
    y: number,
    width: number,
    height: number,
    content?: ReactNode,
    highlight = false
  ) {
    const edge = highlight ? accent : undefined
    const weight = highlight ? "1.5" : undefined
    return (
      <g transform={`translate(${x} ${y})`}>
        <path
          d={`M0 0 10 -6 ${width * 0.866 + 10} ${width * 0.5 - 6}v${height}l-10 6M${width * 0.866} ${width * 0.5}l10-6`}
          stroke={edge}
          strokeWidth={weight}
        />
        <g transform="matrix(.866 .5 0 1 0 0)">
          <rect
            width={width}
            height={height}
            rx="1"
            stroke={edge}
            strokeWidth={weight}
          />
          {content}
        </g>
      </g>
    )
  }

  // Rows are laid out from the bottom so the copy lines never clear the face.
  function shot(width: number, height: number, framed = true) {
    const top = framed ? 28 : 12
    const lower = height - 12
    const upper = lower - 12
    const hatchBottom = Math.max(top + 10, upper - 10)
    return (
      <>
        {framed && <path d={`M0 18H${width}M10 9h3m6 0h3m6 0h3`} />}
        <rect
          x="12"
          y={top}
          width={width - 24}
          height={hatchBottom - top}
          fill={hatch}
        />
        <path
          d={`M12 ${upper}h${width - 24}m-${width - 24} 12h${(width - 24) * 0.6}`}
        />
      </>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-foreground/10 bg-transparent px-4 py-6 sm:px-8">
      <svg
        viewBox="0 0 400 270"
        fill="none"
        aria-hidden="true"
        className="mx-auto w-full max-w-[440px] text-foreground"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient
            id={`${id}-line`}
            x1="65"
            y1="30"
            x2="320"
            y2="245"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="currentColor" stopOpacity=".9" />
            <stop offset=".55" stopColor="currentColor" stopOpacity=".65" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".2" />
          </linearGradient>
          <linearGradient
            id={`${id}-accent`}
            x1="35"
            y1="30"
            x2="350"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity=".35" />
          </linearGradient>
          <pattern
            id={`${id}-hatch`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(30)"
          >
            <path
              d="M0 0V6"
              stroke="currentColor"
              strokeOpacity=".3"
              strokeWidth=".75"
            />
          </pattern>
        </defs>
        <g stroke={line} strokeWidth="1">
          {step === 0 && (
            <>
              {plate(34, 66, 96, 80, shot(96, 80))}
              {plate(152, 66, 96, 80, shot(96, 80))}
              {plate(270, 66, 96, 80, shot(96, 80), true)}
              <path d="M75.6 173V218M193.6 173V218" strokeDasharray="3 3" />
              <path d="M311.6 173V218" stroke={accent} strokeDasharray="3 3" />
              <path d="M44 218h312" />
              <circle cx="75.6" cy="218" r="3.5" />
              <circle cx="193.6" cy="218" r="3.5" />
              <circle
                cx="311.6"
                cy="218"
                r="3.5"
                fill="var(--primary)"
                stroke={accent}
              />
            </>
          )}
          {step === 1 && (
            <>
              <g transform="translate(147 26)">
                <rect width="106" height="30" rx="6" />
                <path d="M14 9h7v5h-7ZM23 9h7v5h-7ZM14 16h7v5h-7ZM23 16h7v5h-7Z" />
                <path d="M44 9h4v12h-4ZM50 9h4v12h-4ZM56 9h4v12h-4Z" />
                <path d="M74 9h18v3H74ZM74 13.5h18v3H74ZM74 18h18v3H74Z" />
                <rect
                  x="39"
                  y="4"
                  width="26"
                  height="22"
                  rx="3"
                  stroke={accent}
                  strokeWidth="1.25"
                />
              </g>
              <path d="M200 56v21" stroke={accent} strokeDasharray="3 3" />
              <path d="M192 69l8 8 8-8" stroke={accent} strokeWidth="1.25" />
              {plate(36, 104, 88, 74, shot(88, 74))}
              {plate(155, 104, 88, 74, shot(88, 74))}
              {plate(274, 104, 88, 74, shot(88, 74))}
            </>
          )}
          {step === 2 && (
            <>
              {plate(26, 72, 96, 80, shot(96, 80))}
              {plate(140, 72, 96, 80, shot(96, 80), true)}
              <path d="M242 148h21" stroke={accent} strokeDasharray="3 3" />
              <path d="M263 143l6 5-6 5" stroke={accent} strokeWidth="1.25" />
              <g transform="translate(274 58)">
                <rect width="92" height="164" rx="8" />
                <path d="M0 24h92M14 12h38" />
                <path d="M14 40h30M14 54h64" />
                <path d="M14 74h36M14 88h64" />
                <path d="M14 108h26M14 122h64" />
                <circle cx="46" cy="54" r="4" stroke={accent} />
                <circle cx="30" cy="88" r="4" stroke={accent} />
                <circle cx="62" cy="122" r="4" stroke={accent} />
                <path d="M14 140h18v18H14ZM38 140h18v18H38Z" />
                <path
                  d="M62 140h18v18H62Z"
                  stroke={accent}
                  strokeWidth="1.25"
                />
              </g>
            </>
          )}
          {step === 3 && (
            <>
              {plate(
                40,
                64,
                44,
                34,
                <rect x="8" y="8" width="28" height="18" fill={hatch} />
              )}
              {plate(
                96,
                64,
                44,
                34,
                <rect x="8" y="8" width="28" height="18" fill={hatch} />
              )}
              {plate(
                40,
                130,
                44,
                34,
                <rect x="8" y="8" width="28" height="18" fill={hatch} />
              )}
              {plate(
                96,
                130,
                44,
                34,
                <rect x="8" y="8" width="28" height="18" fill={hatch} />
              )}
              {plate(220, 40, 120, 88, shot(120, 88))}
              <g transform="translate(220 204)">
                <rect width="114" height="26" rx="4" />
                <path d="M8 7h40v12H8Z" />
                <path d="M56 7h44v12H56Z" stroke={accent} strokeWidth="1.25" />
              </g>
              <path d="M282 198v36" stroke={accent} />
              <circle
                cx="282"
                cy="198"
                r="2.5"
                fill="var(--primary)"
                stroke="none"
              />
            </>
          )}
          {step === 4 && (
            <>
              {plate(24, 64, 68, 80, shot(68, 80))}
              {plate(124, 64, 68, 80, shot(68, 80))}
              {plate(224, 64, 68, 80, shot(68, 80))}
              <path
                d="M98 120h15M198 120h15"
                stroke={accent}
                strokeDasharray="3 3"
              />
              <path
                d="M113 115l6 5-6 5M213 115l6 5-6 5"
                stroke={accent}
                strokeWidth="1.25"
              />
              <path d="M298 120h15" stroke={accent} strokeDasharray="3 3" />
              <path d="M313 115l6 5-6 5" stroke={accent} strokeWidth="1.25" />
              <g transform="translate(324 62)">
                <rect width="62" height="100" rx="8" />
                <path d="M0 24h62M12 12h26" />
                <path d="M12 42h38M12 54h26M12 66h32" />
                <path
                  d="M31 76v14m-7-7 7 7 7-7"
                  stroke={accent}
                  strokeWidth="1.25"
                />
              </g>
            </>
          )}
        </g>
      </svg>
      <figcaption className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        <span className="size-2 shrink-0 bg-primary" />
        {captions[step]}
      </figcaption>
    </figure>
  )
}
