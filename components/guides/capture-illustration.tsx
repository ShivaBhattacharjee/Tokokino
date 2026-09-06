import { useId, type ReactNode } from "react"

const captions = [
  "Paste a link, get a screenshot",
  "One page, three viewports",
  "Wait for the page to settle",
  "Full page in, crop to the moment",
  "Style it like any upload",
  "Signed-out view only",
]

/** Isometric line drawings with transparent faces and theme-aware strokes. */
export function CaptureIllustration({ step }: { step: number }) {
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

  function page(width: number, height: number) {
    return (
      <>
        <path d={`M0 18H${width}M10 9h3m6 0h3m6 0h3`} />
        <rect
          x="12"
          y="30"
          width={width - 24}
          height={height * 0.3}
          fill={hatch}
        />
        <path
          d={`M12 ${height * 0.3 + 42}h${width - 24}m-${width - 24} 12h${(width - 24) * 0.65}`}
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
              {plate(
                45,
                55,
                145,
                40,
                <>
                  <path
                    d="m15 16-6 4 6 4m9-8 6 4-6 4m15-4h88"
                    stroke={accent}
                  />
                </>
              )}
              <path
                d="M119 138v30l75 43 41-24"
                stroke={accent}
                strokeDasharray="3 4"
              />
              <circle
                cx="119"
                cy="138"
                r="2.5"
                fill="var(--primary)"
                stroke="none"
              />
              {plate(235, 91, 120, 98, page(120, 98))}
              <path d="m224 187h11l-5 10" stroke={accent} strokeWidth="1.25" />
            </>
          )}
          {step === 1 && (
            <>
              {plate(38, 55, 148, 88, page(148, 88))}
              <path d="m102 177 0 15-23 13 42 24 23-13-23-13v-15" />
              {plate(
                204,
                64,
                83,
                125,
                <>
                  <rect x="7" y="12" width="69" height="99" fill={hatch} />
                  <path d="M31 6h20m-14 112h8" stroke={accent} />
                </>
              )}
              {plate(
                307,
                93,
                45,
                90,
                <>
                  <rect x="5" y="13" width="35" height="65" />
                  <path d="M16 7h13m-12 76h11" stroke={accent} />
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              {plate(
                85,
                44,
                155,
                130,
                <>
                  <path d="M0 18h155m-143-9h3m6 0h3" />
                  <circle cx="77" cy="72" r="36" fill={hatch} />
                  <circle cx="77" cy="72" r="29" />
                  <path
                    d="M77 47v25l17 10M77 36v7m36 29h-7m-29 36v-7m-36-29h7"
                    stroke={accent}
                  />
                </>
              )}
              <path
                d="m255 121 58 34v61m-48-55 16 9m-16 5 30 17m-30-1 22 13"
                stroke={accent}
              />
              <circle
                cx="313"
                cy="216"
                r="4"
                fill="var(--primary)"
                stroke="none"
              />
            </>
          )}
          {step === 3 && (
            <>
              {plate(
                78,
                22,
                95,
                190,
                <>
                  <path d="M0 18h95M12 9h3m6 0h3" />
                  {[31, 63, 95, 127, 159].map((y) => (
                    <g key={y}>
                      <rect x="12" y={y} width="22" height="19" fill={hatch} />
                      <path d={`M43 ${y + 4}h39m-39 9h29`} />
                    </g>
                  ))}
                  <rect
                    x="5"
                    y="86"
                    width="85"
                    height="43"
                    stroke={accent}
                    strokeDasharray="3 3"
                  />
                </>
              )}
              <path
                d="m166 121 70-40m-70 83 70-40"
                stroke={accent}
                strokeDasharray="2 4"
              />
              {plate(
                239,
                65,
                100,
                65,
                <>
                  <rect x="10" y="12" width="26" height="34" fill={hatch} />
                  <path d="M45 19h44m-44 12h32m-32 12h39" />
                  <path
                    d="M-5 10V-5h15m80 0h15v15M-5 55v15h15m80 0h15V55"
                    stroke={accent}
                  />
                </>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <path
                d="m64 162 135-78 135 78-135 78Zm0 0v10l135 78 135-78v-10m-135 78v10"
                fill={hatch}
              />
              {plate(123, 33, 155, 114, page(155, 114))}
              <path
                d="m78 153 24 14m176 27 28-16m-111 49 27-15"
                stroke={accent}
              />
              <path d="m286 80 38 22v38l-38-22Zm0 0 8-5 38 22v38l-8 5m0-38 8-5" />
              <path d="m296 96 19 11m-19 1 13 8" stroke={accent} />
            </>
          )}
          {step === 5 && (
            <>
              {plate(67, 56, 130, 110, page(130, 110))}
              <path
                d="m270 42-38 22v118l38 22 38-22V64Zm-38 22 38 22 38-22m-38 22v118"
                fill={hatch}
              />
              <g transform="matrix(.866 .5 0 1 239 99)">
                <rect x="0" y="20" width="29" height="31" />
                <path d="M5 20V9a10 10 0 0 1 20 0v11M15 33v8" stroke={accent} />
              </g>
              <path d="m182 182 29 17m-29-17 5 9m-5-9 9-2" stroke={accent} />
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
