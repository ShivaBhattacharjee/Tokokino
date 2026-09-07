import { useId, type ReactNode } from "react"

const captions = [
  "A catalogue of starting points",
  "Save the look, not the pixels",
  "The whole project, kept in the cloud",
  "Timelines travel with animate presets",
  "Drafts metered, presets unlimited",
  "One preset, a series of releases",
]

/** Isometric line drawings with transparent faces and theme-aware strokes. */
export function PresetIllustration({ step }: { step: number }) {
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
    content?: ReactNode
  ) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path
          d={`M0 0 10 -6 ${width * 0.866 + 10} ${width * 0.5 - 6}v${height}l-10 6M${width * 0.866} ${width * 0.5}l10-6`}
        />
        <g transform="matrix(.866 .5 0 1 0 0)">
          <rect width={width} height={height} rx="1" />
          {content}
        </g>
      </g>
    )
  }

  function shot(width: number, height: number, framed = true) {
    return (
      <>
        {framed && <path d={`M0 18H${width}M10 9h3m6 0h3m6 0h3`} />}
        <rect
          x="12"
          y={framed ? 30 : 12}
          width={width - 24}
          height={height * 0.32}
          fill={hatch}
        />
        <path
          d={`M12 ${height * 0.32 + (framed ? 42 : 24)}h${width - 24}m-${width - 24} 12h${(width - 24) * 0.6}`}
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
              {plate(38, 56, 105, 100, shot(105, 100))}
              {plate(152, 56, 105, 100, shot(105, 100))}
              {plate(
                266,
                56,
                105,
                100,
                <>
                  {shot(105, 100)}
                  <path
                    d="M45 38l20 12-20 12Z"
                    stroke={accent}
                    strokeWidth="1.25"
                  />
                </>
              )}
              <path d="M88.5 185.1V232M202.5 185.1V232" strokeDasharray="3 4" />
              <path
                d="M316.5 185.1V232"
                stroke={accent}
                strokeDasharray="3 4"
              />
              <path d="M30 232h340" />
              <circle cx="88.5" cy="232" r="3" />
              <circle cx="202.5" cy="232" r="3" />
              <circle
                cx="316.5"
                cy="232"
                r="3"
                fill="var(--primary)"
                stroke={accent}
              />
            </>
          )}
          {step === 1 && (
            <>
              {plate(45, 50, 150, 115, shot(150, 115))}
              <path d="M190 165h30" stroke={accent} strokeDasharray="3 4" />
              <path d="m214 160 6 5-6 5" stroke={accent} strokeWidth="1.25" />
              {plate(
                226,
                100,
                120,
                80,
                <>
                  <path
                    d="M14 14h60l12 12v40H14Z"
                    stroke={accent}
                    strokeDasharray="3 3"
                  />
                  <path d="M24 34h52m-52 12h36m-36 12h44" />
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              {plate(24, 128, 100, 84, shot(100, 84))}
              <g transform="translate(157 26)">
                <path d="M20 48a16 16 0 0 1 3-31 22 22 0 0 1 43-3 17 17 0 0 1 5 34Z" />
              </g>
              <path d="M80 145 183 78" stroke={accent} strokeDasharray="3 4" />
              <path
                d="M177.7 86.3 183 78 173.3 79.6"
                stroke={accent}
                strokeWidth="1.25"
              />
              <path d="M222 78 324 140" stroke={accent} strokeDasharray="3 4" />
              <path
                d="M317.1 138.6 324 140 319.6 134.5"
                stroke={accent}
                strokeWidth="1.25"
              />
              {plate(276, 128, 100, 84, shot(100, 84))}
            </>
          )}
          {step === 3 && (
            <>
              {plate(52, 50, 130, 90, shot(130, 90))}
              <path d="M102.2 169V189M114.4 176V196" />
              <path d="M87.5 180.5 129.1 204.5 109.1 216.5 67.5 192.5Z" />
              <path d="M176 174h18" stroke={accent} strokeDasharray="3 4" />
              <path d="m188 169 6 5-6 5" stroke={accent} strokeWidth="1.25" />
              <g transform="translate(198 154)">
                <path d="M0 0h148M0 34h148M0 0v34M148 0v34" />
                <path
                  d="M74 40V-16m-5 8 5-8 5 8"
                  stroke={accent}
                  strokeWidth="1.25"
                />
                <path
                  d="M22 0v34M126 0v34"
                  stroke={accent}
                  strokeDasharray="2 3"
                />
                <path d="M22 22 74 8 126 20" stroke={accent} />
                <circle cx="22" cy="22" r="3.5" stroke={accent} />
                <path
                  d="M74 1l7 7-7 7-7-7Z"
                  fill="var(--primary)"
                  stroke="none"
                />
                <circle cx="126" cy="20" r="3.5" stroke={accent} />
              </g>
            </>
          )}
          {step === 4 && (
            <>
              {plate(50, 60, 130, 100, shot(130, 100))}
              <path d="M174 142h16" stroke={accent} strokeDasharray="3 4" />
              <path d="M198 113.5h-8v57h8" stroke={accent} />
              <circle
                cx="190"
                cy="142"
                r="3"
                fill="var(--primary)"
                stroke="none"
              />
              <g transform="translate(200 100.5)">
                <rect width="140" height="26" />
                <rect width="96" height="26" fill={hatch} />
                <rect
                  width="96"
                  height="26"
                  stroke={accent}
                  strokeWidth="1.25"
                />
              </g>
              <g transform="translate(200 148.5)">
                <path d="M0 0h140M0 44h140" />
                <path
                  d="M8 22c8-12 24-12 32 0s24 12 32 0 24-12 32 0"
                  stroke={accent}
                  strokeWidth="1.25"
                />
                <path
                  d="M104 22c8-12 24-12 32 0"
                  stroke={accent}
                  strokeDasharray="2 3"
                />
              </g>
            </>
          )}
          {step === 5 && (
            <>
              {plate(145, 16, 110, 64, shot(110, 64))}
              <path
                d="M197.7 110.4V148M67.7 148h260"
                stroke={accent}
                strokeDasharray="3 4"
              />
              <path
                d="M67.7 148v20.6M197.7 148v20.6M327.7 148v20.6"
                stroke={accent}
              />
              <circle
                cx="67.7"
                cy="148"
                r="2.5"
                fill="var(--primary)"
                stroke="none"
              />
              <circle
                cx="197.7"
                cy="148"
                r="2.5"
                fill="var(--primary)"
                stroke="none"
              />
              <circle
                cx="327.7"
                cy="148"
                r="2.5"
                fill="var(--primary)"
                stroke="none"
              />
              {plate(28.9, 158, 78, 58, shot(78, 58, false))}
              {plate(158.9, 158, 78, 58, shot(78, 58, false))}
              {plate(288.9, 158, 78, 58, shot(78, 58, false))}
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
