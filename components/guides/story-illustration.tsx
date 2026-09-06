import { useId } from "react"

const captions = [
  "A capture is the starting point",
  "Build a setting around your screen",
  "Give the eye somewhere to go",
  "Show the change over time",
  "Keep a set of visuals consistent",
  "One composition, several ways to share",
  "An open toolkit, built around the work",
  "A launch, a walkthrough, a product update",
  "Colour and texture on separate planes",
  "Trim the recording, keep the moment",
  "Keep an editable copy and share the result",
  "Choose the workflow that fits your project",
]

/** Isometric line drawings with transparent faces and theme-aware strokes. */
export function StoryIllustration({ step }: { step: number }) {
  const id = useId().replace(/:/g, "")
  const line = `url(#${id}-line)`
  const accent = `url(#${id}-accent)`
  const hatch = `url(#${id}-hatch)`

  function screen(x: number, y: number, scale = 1) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path d="M0 0 110 63V158L0 95ZM0 0 12-7 122 56V151L110 158M110 63l12-7" />
        <path d="m0 19 110 63M12 17l5 3m8 5 5 3m8 5 5 3" />
        <path d="m14 41 35 20v34L14 75Z" fill={hatch} />
        <path d="m61 68 34 20m-34-7 26 15m-26-2 34 20" />
        <path d="m14 87 81 47" stroke={accent} />
      </g>
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
          <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
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
              {screen(135, 52)}
              <path
                d="m112 48-16-9v21m175 68 16 9v-21M112 167l-16-9v-21m175 110 16 9v-21"
                stroke={accent}
              />
            </>
          )}
          {step === 1 && (
            <>
              {[0, 28, 56].map((y) => (
                <g key={y} transform={`translate(0 ${y})`}>
                  <path d="m85 99 120-69 120 69-120 69Zm0 0v9l120 69 120-69v-9m-120 69v9" />
                </g>
              ))}
              <path
                d="m121 99 84-48 84 48-84 48Z"
                fill={hatch}
                stroke={accent}
              />
              <path
                d="M205 30V16m0 217v20"
                stroke={accent}
                strokeDasharray="2 4"
              />
            </>
          )}
          {step === 2 && (
            <>
              {screen(108, 58)}
              <path d="m150 142 25 14v-29l-25-14Z" stroke={accent} />
              <path d="m175 127 94-54m-94 54 6-14m-6 14 15 2" stroke={accent} />
              <path
                d="m249 57 35 20 22-13-35-20Zm0 0v25l35 20 22-13V64m-22 13v25"
                fill={hatch}
              />
              <circle
                cx="269"
                cy="73"
                r="4"
                fill="var(--primary)"
                stroke="none"
              />
            </>
          )}
          {step === 3 && (
            <>
              <path
                d="m70 181 215-124 21 12L91 193Zm0 0v17l21 12L306 86V69M91 193v17"
                fill={hatch}
              />
              <path d="m70 181-7-4v-14L278 39l7 4v14M63 163l7 4L285 43M70 167v14m21 12v-14L306 55l7 4v27l-7 0m-215 93 7 4L313 59m-215 124v23" />
              <path d="m118 91 77 44m60-35 57 33m-117 2v96" stroke={accent} />
              {[
                [118, 91],
                [312, 133],
                [195, 231],
              ].map(([cx, cy]) => (
                <circle
                  key={cx}
                  cx={cx}
                  cy={cy}
                  r="5"
                  fill="var(--primary)"
                  stroke="none"
                />
              ))}
            </>
          )}
          {step === 4 && (
            <>
              {screen(70, 65, 0.75)}
              {screen(161, 48, 0.75)}
              {screen(252, 31, 0.75)}
              <path
                d="m112 201 79 45 104-60m-104 60v-40"
                stroke={accent}
                strokeDasharray="3 5"
              />
            </>
          )}
          {step === 5 && (
            <>
              <path
                d="m63 128 65-38 65 38-65 38Zm0 0v60l65 38 65-38v-60m-65 38v60"
                fill={hatch}
              />
              {screen(274, 33, 0.42)}
              {screen(274, 153, 0.42)}
              <path
                d="m193 157 41-24V71l40-23m-40 85v56l40-23"
                stroke={accent}
              />
              <circle
                cx="234"
                cy="133"
                r="4"
                fill="var(--primary)"
                stroke="none"
              />
            </>
          )}
          {step === 6 && (
            <>
              <path
                d="m100 128 100-58 100 58-100 58Zm0 0v65l100 58 100-58v-65m-100 58v65"
                fill={hatch}
              />
              <path d="m100 128-35-46 100-58 35 46m0 0 35-46 100 58-35 46" />
              <path
                d="m174 106-22 13 22 13m52-26 22 13-22 13m-19-34-14 42"
                stroke={accent}
                strokeWidth="1.5"
              />
            </>
          )}
          {step === 7 && (
            <>
              {screen(62, 82, 0.65)}
              <path d="m183 51 43 25v99l-43-25Zm0 0 9-5 43 25v99l-9 5m0-99 9-5m-45 63 29 17" />
              <path d="m278 82 65 37v69l-65-37Zm0 0 9-5 65 37v69l-9 5m0-69 9-5" />
              <path
                d="m302 118 19 22-19 0Z M102 206l87 34 112-28"
                stroke={accent}
              />
            </>
          )}
          {step === 8 && (
            <>
              <path
                d="m80 160 120-69 120 69-120 69Zm0 0v10l120 69 120-69v-10m-120 69v10"
                fill={hatch}
              />
              <path d="m80 110 120-69 120 69-120 69Zm0 0v8l120 69 120-69v-8m-120 69v8" />
              <g transform="matrix(1 -.575 1 .575 105 109)" stroke={accent}>
                {Array.from({ length: 6 }, (_, row) =>
                  Array.from({ length: 6 }, (_, col) => (
                    <path
                      key={`${row}-${col}`}
                      d={`M${col * 16} ${row * 16}h6m-3-3v6`}
                      opacity={0.3 + row * 0.12}
                    />
                  ))
                )}
              </g>
              <path
                d="M200 22v15m0 155v29"
                stroke={accent}
                strokeDasharray="2 4"
              />
            </>
          )}
          {step === 9 && (
            <>
              <path d="m85 44 156 90v90L85 134Zm0 0 12-7 156 90v90l-12 7m0-90 12-7" />
              <path d="m148 105 29 35-29 1Z" stroke={accent} />
              <path
                d="m64 180 78-45 172 99-26 15-172-99m26-15v13l172 99v-13"
                fill={hatch}
              />
              <path
                d="m113 158 6 3v-13l6 3v25l6 3v-35l6 3v24l6 3v-10m76 40v-20m59 55v-20"
                stroke={accent}
              />
            </>
          )}
          {step === 10 && (
            <>
              <path d="m76 113 67-39 67 39-67 39Zm0 0v84l67 39 67-39v-84m-67 39v84m-67-61 67 39 67-39m-134-28 67 39 67-39" />
              <path
                d="m91 127 21 12m-21 16 21 12m-21 16 21 12"
                stroke={accent}
              />
              {screen(277, 45, 0.5)}
              <path
                d="m210 155 37-21V94l30-17m-30 17-8 14m8-14 10 3"
                stroke={accent}
              />
            </>
          )}
          {step === 11 && (
            <>
              <path d="m178 196 22-13 22 13v19l-22 13-22-13Zm0 0 22 13 22-13m-22 13v19M200 183V119" />
              <path
                d="m95 142 45-26 45 26-45 26Zm0 0v9l45 26 45-26v-9m-45 26v9m75-71 45-26 45 26-45 26Zm0 0v9l45 26 45-26v-9m-45 26v9"
                fill={hatch}
              />
              <path
                d="m140 116 60-35 60 35m-60-35v38m-60-3V89m120 27V55"
                stroke={accent}
              />
              <circle
                cx="200"
                cy="81"
                r="4"
                fill="var(--primary)"
                stroke="none"
              />
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
