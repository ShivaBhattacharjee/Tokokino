import { useId, type ReactNode } from "react"

const captions = [
  "The canvas holds the composition; the frame holds the screen",
  "Choose the space before arranging the content",
  "A sequence of screenshots, each with one clear point",
  "Match the phone to the interface you are showing",
  "Give tablet layouts room to breathe",
  "Wide interfaces belong on wider screens",
  "Keep small-screen content readable",
  "Hardware, browser chrome, or translucent glass",
  "Reuse the treatment across the set",
  "Shape and pixel dimensions are separate choices",
]

export function FrameDrawing({ step = 0 }: { step?: number }) {
  const id = useId().replace(/:/g, "")
  const accent = `url(#${id}-accent)`
  const hatch = `url(#${id}-hatch)`
  function panel(
    x: number,
    y: number,
    w: number,
    h: number,
    children?: ReactNode
  ) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path
          d={`M0 0 9-5 ${w * 0.866 + 9} ${w * 0.5 - 5}v${h}l-9 5M${w * 0.866} ${w * 0.5}l9-5`}
        />
        <g transform="matrix(.866 .5 0 1 0 0)">
          <rect width={w} height={h} rx="2" />
          {children}
        </g>
      </g>
    )
  }
  function device(x: number, y: number, w: number, h: number) {
    return panel(
      x,
      y,
      w,
      h,
      <>
        <rect x="6" y="13" width={w - 12} height={h - 24} rx="2" fill={hatch} />
        <path
          d={`M${w / 2 - 7} 6h14M${w / 2 - 7} ${h - 5}h14`}
          stroke={accent}
        />
      </>
    )
  }
  return (
    <svg
      viewBox="0 0 400 280"
      fill="none"
      aria-hidden="true"
      className="h-full w-full text-foreground"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient
          id={`${id}-line`}
          x1="30"
          y1="20"
          x2="360"
          y2="270"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity=".9" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".25" />
        </linearGradient>
        <linearGradient id={`${id}-accent`}>
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity=".45" />
        </linearGradient>
        <pattern
          id={`${id}-hatch`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(30)"
        >
          <path d="M0 0v7" stroke="currentColor" strokeOpacity=".15" />
        </pattern>
      </defs>
      <g stroke={`url(#${id}-line)`}>
        {step === 0 && (
          <>
            {panel(85, 32, 240, 118)}
            {device(165, 66, 55, 103)}
            <path d="m68 38 0 123 195 112M258 264l5 9-10 0" stroke={accent} />
          </>
        )}
        {step === 1 && (
          <>
            {panel(
              37,
              77,
              90,
              90,
              <rect
                x="10"
                y="10"
                width="70"
                height="70"
                fill={hatch}
                stroke={accent}
              />
            )}
            {panel(
              147,
              43,
              62,
              130,
              <rect
                x="10"
                y="10"
                width="42"
                height="110"
                fill={hatch}
                stroke={accent}
              />
            )}
            {panel(
              232,
              89,
              138,
              78,
              <rect
                x="10"
                y="10"
                width="118"
                height="58"
                fill={hatch}
                stroke={accent}
              />
            )}
          </>
        )}
        {step === 2 && (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                {panel(
                  50 + i * 104,
                  48,
                  77,
                  155,
                  <>
                    <path d="M12 15h53m-53 9h35" stroke={accent} />
                    <rect
                      x="19"
                      y="41"
                      width="39"
                      height="94"
                      rx="5"
                      fill={hatch}
                    />
                    <path d="M30 48h17" />
                  </>
                )}
              </g>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            {device(78, 70, 58, 119)}
            {device(169, 40, 68, 143)}
            {device(269, 82, 52, 110)}
          </>
        )}
        {step === 4 && (
          <>
            {device(60, 44, 106, 150)}
            {device(206, 112, 141, 87)}
          </>
        )}
        {step === 5 && (
          <>
            {panel(
              108,
              8,
              190,
              108,
              <rect x="8" y="8" width="174" height="92" fill={hatch} />
            )}
            <path d="M108 116l-94 54 165 95 94-54m-259-41 165 95v7L14 177v-7m165 102 94-54v-7" />
            <path
              d="M110 123l-43 25 147 85 43-25ZM103 175l-29 17 68 39 29-17Z"
              stroke={accent}
            />
          </>
        )}
        {step === 6 && (
          <g>
            <rect x="154" y="18" width="92" height="70" rx="12" fill={hatch} />
            <rect x="154" y="192" width="92" height="70" rx="12" fill={hatch} />
            <path d="M164 88v-8m72 8v-8M164 200v-8m72 8v-8" stroke={accent} />
            <rect x="147" y="78" width="106" height="124" rx="34" />
            <rect
              x="156"
              y="88"
              width="88"
              height="104"
              rx="26"
              opacity=".55"
            />
            <circle cx="200" cy="140" r="33" />
            <path
              d="M200 140v-24m0 24 20 16"
              stroke={accent}
              strokeWidth="1.5"
            />
            <circle
              cx="200"
              cy="140"
              r="2.5"
              fill="var(--primary)"
              stroke="none"
            />
            <rect x="253" y="130" width="9" height="20" rx="3" />
          </g>
        )}
        {step === 7 && (
          <>
            {[2, 1, 0].map((i) => (
              <g key={i} opacity={1 - i * 0.23}>
                {panel(
                  16 + i * 122,
                  34 + i * 22,
                  138,
                  100,
                  i === 0 ? (
                    <>
                      <path
                        d="M10 18h118M20 9h3.5m6 0h3.5m15 0h3.5"
                        stroke="var(--background)"
                        strokeWidth="5"
                      />
                      <path
                        d="M10 18h118M20 9h3.5m6 0h3.5m15 0h3.5"
                        stroke={accent}
                      />
                      <rect
                        x="12"
                        y="30"
                        width="114"
                        height="54"
                        fill={hatch}
                      />
                    </>
                  ) : undefined
                )}
              </g>
            ))}
          </>
        )}
        {step === 8 && (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                {device(56 + i * 106, 40 + i * 13, 65, 123)}
                <path
                  d={`m${67 + i * 106} ${190 + i * 13} 40 23`}
                  stroke={accent}
                />
              </g>
            ))}
          </>
        )}
        {step === 9 && (
          <>
            {panel(
              74,
              49,
              182,
              122,
              <>
                <rect x="12" y="12" width="158" height="98" fill={hatch} />
                <path d="M12 110 170 12" stroke={accent} />
              </>
            )}
            <path d="m62 45 0 129 169 98M226 264l5 8-10 0" stroke={accent} />
          </>
        )}
      </g>
    </svg>
  )
}

export function FrameIllustration({ step }: { step: number }) {
  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-foreground/10 bg-transparent px-5 py-6">
      <div className="mx-auto aspect-[10/7] max-w-[440px]">
        <FrameDrawing step={step} />
      </div>
      <figcaption className="mt-3 flex gap-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        <span className="mt-1 size-2 shrink-0 bg-primary" />
        {captions[step]}
      </figcaption>
    </figure>
  )
}
