import { motion } from "motion/react"
import { RiBlueskyFill, RiTwitterXLine } from "@remixicon/react"
import { FEATURES, ease } from "@/components/landing/constants"

const ICONS: Record<string, React.ReactNode> = {
  "01": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="18.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  "02": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  "03": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="2"
        className="opacity-40"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  ),
  "04": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" strokeDasharray="2 2" />
      <line x1="10" y1="6" x2="10" y2="18" strokeDasharray="2 2" />
    </svg>
  ),
  "05": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  ),
  "06": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
      <path d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
  "07": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
    </svg>
  ),
  "08": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6l5-3-5-3z" fill="currentColor" stroke="none" />
      <path d="M14 9h4M14 12h3M14 15h4" />
    </svg>
  ),
  "09": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  "10": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="2" y="5" width="10" height="14" rx="2" />
      <rect x="14" y="7" width="8" height="10" rx="2" opacity="0.6" />
    </svg>
  ),
  "11": <RiTwitterXLine className="size-5" />,
  "12": <RiBlueskyFill className="size-5" />,
  "13": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="8" x2="21" y2="8" />
      <circle cx="6" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="3" />
    </svg>
  ),
  "16": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect
        x="13"
        y="3"
        width="8"
        height="5"
        rx="1.5"
        className="opacity-40"
        fill="currentColor"
        stroke="none"
      />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  "17": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <circle cx="12" cy="12" r="9" />
      <circle
        cx="12"
        cy="12"
        r="3.5"
        fill="currentColor"
        stroke="none"
        className="opacity-70"
      />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  ),
  "18": (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <path d="M9 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" />
      <path d="M15 11a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5" />
    </svg>
  ),
}

export function FeatureRow() {
  return (
    <section
      id="features"
      className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <div className="mb-12 flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
          {"// Features"}
        </span>
        <h2 className="text-2xl tracking-tight sm:text-3xl">
          Product polish, without opening Figma.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.k}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease, delay: i * 0.05 }}
            className="group rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm transition-colors hover:border-border/90"
          >
            <div className="flex h-full flex-col gap-4 rounded-[8px] border border-border/40 bg-background/60 p-5 transition-colors group-hover:bg-background/80">
              <span className="text-foreground/50 transition-colors group-hover:text-foreground/80">
                {ICONS[f.k]}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                  {f.t}
                </h3>
                <p className="text-[13px] leading-relaxed text-foreground/50">
                  {f.d}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
