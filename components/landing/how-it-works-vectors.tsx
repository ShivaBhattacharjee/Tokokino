"use client"

import type { ComponentProps, ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { ease } from "@/components/landing/constants"

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const stroke = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.5, ease },
      opacity: { duration: 0.15 },
    },
  },
}

const solid = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
}

function Vector({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      variants={container}
      initial={shouldReduceMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.6 }}
      className="size-full text-foreground/70"
    >
      {children}
    </motion.svg>
  )
}

function Ghost({
  children,
  opacity = 0.3,
}: {
  children: ReactNode
  opacity?: number
}) {
  return <g opacity={opacity}>{children}</g>
}

const P = (props: ComponentProps<typeof motion.path>) => (
  <motion.path variants={stroke} {...props} />
)
const R = (props: ComponentProps<typeof motion.rect>) => (
  <motion.rect variants={stroke} {...props} />
)
const C = (props: ComponentProps<typeof motion.circle>) => (
  <motion.circle variants={stroke} {...props} />
)
const L = (props: ComponentProps<typeof motion.line>) => (
  <motion.line variants={stroke} {...props} />
)
const Dot = (props: ComponentProps<typeof motion.circle>) => (
  <motion.circle
    variants={solid}
    fill="currentColor"
    stroke="none"
    {...props}
  />
)

function CropMarks({
  x,
  y,
  w,
  h,
}: {
  x: number
  y: number
  w: number
  h: number
}) {
  const arm = 4
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]

  return (
    <Ghost opacity={0.55}>
      {corners.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <L x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
          <L x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
        </g>
      ))}
    </Ghost>
  )
}

export function ImportVector() {
  return (
    <Vector>
      <Ghost>
        <R x={42} y={8} width={36} height={24} rx={4} />
      </Ghost>
      <L x1={60} y1={38} x2={60} y2={62} />
      <P d="M53 55 L60 62 L67 55" />
      <R x={18} y={70} width={84} height={36} rx={7} />
    </Vector>
  )
}

export function FrameVector() {
  return (
    <Vector>
      <Ghost>
        <R x={14} y={14} width={92} height={92} rx={16} />
      </Ghost>
      <R x={28} y={28} width={64} height={64} rx={10} />
      <Ghost opacity={0.5}>
        <R x={44} y={44} width={32} height={32} rx={5} />
      </Ghost>
      <CropMarks x={28} y={28} w={64} h={64} />
    </Vector>
  )
}

export function StyleVector() {
  return (
    <Vector>
      <Ghost opacity={0.22}>
        <P d="M6 62 A54 54 0 0 1 114 62" />
      </Ghost>
      <Ghost opacity={0.4}>
        <P d="M14 62 A46 46 0 0 1 106 62" />
      </Ghost>
      <P d="M22 62 A38 38 0 0 1 98 62" />
      <C cx={60} cy={62} r={22} />
      <Ghost opacity={0.45}>
        <L x1={10} y1={62} x2={110} y2={62} />
      </Ghost>
    </Vector>
  )
}

export function ContextVector() {
  return (
    <Vector>
      <Ghost>
        <R x={20} y={26} width={72} height={58} rx={7} />
      </Ghost>
      <L x1={32} y1={44} x2={70} y2={44} />
      <L x1={32} y1={56} x2={58} y2={56} />
      <P d="M100 104 L70 70" />
      <P d="M70 70 L82 72 M70 70 L72 82" />
      <Ghost opacity={0.55}>
        <L x1={80} y1={30} x2={80} y2={40} />
        <L x1={75} y1={35} x2={85} y2={35} />
      </Ghost>
    </Vector>
  )
}

export function ExportVector() {
  return (
    <Vector>
      <Ghost>
        <R x={22} y={52} width={76} height={54} rx={7} />
      </Ghost>
      <L x1={60} y1={78} x2={60} y2={20} />
      <P d="M47 33 L60 20 L73 33" />
      <Ghost opacity={0.5}>
        <L x1={34} y1={92} x2={60} y2={92} />
        <L x1={70} y1={92} x2={86} y2={92} />
      </Ghost>
    </Vector>
  )
}

export function DevicesVector() {
  return (
    <Vector>
      <R x={12} y={30} width={68} height={54} rx={6} />
      <L x1={12} y1={43} x2={80} y2={43} />
      <Dot cx={21} cy={37} r={1.7} />
      <Dot cx={27} cy={37} r={1.7} />
      <Dot cx={33} cy={37} r={1.7} />
      <Ghost opacity={0.55}>
        <R x={84} y={40} width={24} height={48} rx={6} />
        <L x1={92} y1={47} x2={100} y2={47} />
      </Ghost>
    </Vector>
  )
}

export function DepthVector() {
  return (
    <Vector>
      <Ghost opacity={0.25}>
        <R x={14} y={22} width={66} height={48} rx={7} />
      </Ghost>
      <Ghost opacity={0.5}>
        <R x={27} y={35} width={66} height={48} rx={7} />
      </Ghost>
      <R x={40} y={48} width={66} height={48} rx={7} />
    </Vector>
  )
}

export function LaunchVector() {
  return (
    <Vector>
      <Ghost>
        <C cx={60} cy={60} r={30} />
      </Ghost>
      <L x1={60} y1={100} x2={60} y2={22} />
      <P d="M48 34 L60 22 L72 34" />
      <Ghost opacity={0.5}>
        <L x1={40} y1={96} x2={46} y2={90} />
        <L x1={80} y1={96} x2={74} y2={90} />
      </Ghost>
    </Vector>
  )
}

export function DemoVector() {
  return (
    <Vector>
      <C cx={64} cy={60} r={26} />
      <P d="M57 49 L57 71 L77 60 Z" />
      <Ghost opacity={0.45}>
        <P d="M30 40 A34 34 0 0 0 30 80" />
      </Ghost>
      <Ghost opacity={0.22}>
        <P d="M18 32 A46 46 0 0 0 18 88" />
      </Ghost>
    </Vector>
  )
}

export function AppStoreVector() {
  return (
    <Vector>
      <Ghost opacity={0.4}>
        <R x={4} y={30} width={30} height={60} rx={6} />
      </Ghost>
      <R x={42} y={22} width={36} height={76} rx={7} />
      <L x1={54} y1={31} x2={66} y2={31} />
      <Ghost opacity={0.4}>
        <R x={86} y={30} width={30} height={60} rx={6} />
      </Ghost>
    </Vector>
  )
}

export function ChangelogVector() {
  return (
    <Vector>
      <L x1={12} y1={62} x2={108} y2={62} />
      <Ghost opacity={0.45}>
        <C cx={30} cy={62} r={6} />
      </Ghost>
      <C cx={60} cy={62} r={9} />
      <Dot cx={60} cy={62} r={2.6} />
      <Ghost opacity={0.45}>
        <C cx={90} cy={62} r={6} />
      </Ghost>
      <Ghost opacity={0.5}>
        <L x1={60} y1={40} x2={60} y2={48} />
      </Ghost>
    </Vector>
  )
}

export function DocsVector() {
  return (
    <Vector>
      <R x={22} y={16} width={66} height={86} rx={7} />
      <L x1={34} y1={38} x2={76} y2={38} />
      <L x1={34} y1={52} x2={76} y2={52} />
      <Ghost opacity={0.5}>
        <L x1={34} y1={66} x2={60} y2={66} />
      </Ghost>
      <P d="M108 82 L84 54" />
      <P d="M84 54 L95 57 M84 54 L87 65" />
    </Vector>
  )
}

export function LandingVector() {
  return (
    <Vector>
      <R x={14} y={18} width={92} height={46} rx={7} />
      <Ghost opacity={0.45}>
        <R x={14} y={74} width={26} height={28} rx={5} />
        <R x={47} y={74} width={26} height={28} rx={5} />
        <R x={80} y={74} width={26} height={28} rx={5} />
      </Ghost>
    </Vector>
  )
}

export function SocialVector() {
  return (
    <Vector>
      <R x={16} y={22} width={88} height={56} rx={12} />
      <P d="M38 78 L34 96 L56 78" />
      <C cx={38} cy={42} r={8} />
      <L x1={54} y1={39} x2={88} y2={39} />
      <Ghost opacity={0.55}>
        <L x1={54} y1={50} x2={78} y2={50} />
        <L x1={30} y1={63} x2={88} y2={63} />
      </Ghost>
    </Vector>
  )
}

export function DeckVector() {
  return (
    <Vector>
      <Ghost opacity={0.25}>
        <R x={24} y={14} width={84} height={48} rx={6} />
      </Ghost>
      <R x={12} y={26} width={84} height={48} rx={6} />
      <L x1={54} y1={74} x2={54} y2={94} />
      <Ghost opacity={0.55}>
        <L x1={34} y1={94} x2={74} y2={94} />
      </Ghost>
    </Vector>
  )
}

export function UrlVector() {
  return (
    <Vector>
      <R x={10} y={28} width={100} height={64} rx={8} />
      <L x1={10} y1={46} x2={110} y2={46} />
      <Ghost opacity={0.5}>
        <R x={32} y={32} width={68} height={9} rx={4.5} />
      </Ghost>
      <Dot cx={19} cy={37} r={1.8} />
      <Dot cx={25} cy={37} r={1.8} />
      <Ghost opacity={0.45}>
        <L x1={24} y1={62} x2={96} y2={62} />
        <L x1={24} y1={74} x2={70} y2={74} />
      </Ghost>
    </Vector>
  )
}

export function ClipVector() {
  return (
    <Vector>
      <R x={10} y={32} width={100} height={56} rx={8} />
      <Ghost opacity={0.4}>
        <L x1={30} y1={32} x2={30} y2={88} />
        <L x1={90} y1={32} x2={90} y2={88} />
      </Ghost>
      <P d="M52 48 L52 72 L74 60 Z" />
    </Vector>
  )
}

export function LinkCardVector() {
  return (
    <Vector>
      <R x={14} y={22} width={92} height={76} rx={9} />
      <C cx={34} cy={44} r={8} />
      <Ghost opacity={0.5}>
        <L x1={50} y1={40} x2={92} y2={40} />
        <L x1={50} y1={50} x2={76} y2={50} />
      </Ghost>
      <R x={32} y={70} width={26} height={12} rx={6} />
      <Ghost opacity={0.55}>
        <R x={54} y={70} width={26} height={12} rx={6} />
      </Ghost>
    </Vector>
  )
}

export function TextVector() {
  return (
    <Vector>
      <L x1={36} y1={34} x2={84} y2={34} />
      <L x1={60} y1={34} x2={60} y2={86} />
      <Ghost opacity={0.35}>
        <R x={26} y={24} width={68} height={72} rx={2} />
      </Ghost>
      <Dot cx={26} cy={24} r={2.4} />
      <Dot cx={94} cy={24} r={2.4} />
      <Dot cx={26} cy={96} r={2.4} />
      <Dot cx={94} cy={96} r={2.4} />
    </Vector>
  )
}

export function ShapesVector() {
  return (
    <Vector>
      <C cx={46} cy={52} r={24} />
      <Ghost opacity={0.5}>
        <R x={54} y={44} width={48} height={48} rx={7} />
      </Ghost>
      <Ghost opacity={0.35}>
        <P d="M18 94 L44 94 L31 72 Z" />
      </Ghost>
    </Vector>
  )
}

export function SlotsVector() {
  return (
    <Vector>
      <Ghost opacity={0.4}>
        <g transform="rotate(-13 26 62)">
          <R x={4} y={44} width={42} height={34} rx={5} />
        </g>
        <g transform="rotate(13 94 62)">
          <R x={74} y={44} width={42} height={34} rx={5} />
        </g>
      </Ghost>
      <R x={32} y={36} width={56} height={44} rx={7} />
    </Vector>
  )
}

export function TimelineVector() {
  return (
    <Vector>
      <R x={8} y={44} width={34} height={18} rx={4} />
      <Ghost opacity={0.45}>
        <R x={48} y={44} width={26} height={18} rx={4} />
        <R x={80} y={44} width={32} height={18} rx={4} />
      </Ghost>
      <Ghost opacity={0.4}>
        <L x1={8} y1={80} x2={112} y2={80} />
        <L x1={20} y1={84} x2={20} y2={90} />
        <L x1={44} y1={84} x2={44} y2={90} />
        <L x1={68} y1={84} x2={68} y2={90} />
        <L x1={92} y1={84} x2={92} y2={90} />
      </Ghost>
      <L x1={62} y1={26} x2={62} y2={92} />
      <R x={57} y={20} width={10} height={9} rx={2} />
    </Vector>
  )
}

export function EasingVector() {
  return (
    <Vector>
      <Ghost opacity={0.35}>
        <L x1={18} y1={22} x2={18} y2={98} />
        <L x1={18} y1={98} x2={104} y2={98} />
      </Ghost>
      <P d="M18 98 C 40 98, 62 28, 104 28" />
      <Ghost opacity={0.5}>
        <L x1={18} y1={98} x2={40} y2={98} />
        <L x1={104} y1={28} x2={82} y2={28} />
      </Ghost>
      <Dot cx={40} cy={98} r={3} />
      <Dot cx={82} cy={28} r={3} />
    </Vector>
  )
}

export function TargetVector() {
  return (
    <Vector>
      <Ghost opacity={0.35}>
        <R x={22} y={28} width={76} height={60} rx={8} />
      </Ghost>
      <C cx={60} cy={58} r={15} />
      <L x1={60} y1={34} x2={60} y2={42} />
      <L x1={60} y1={74} x2={60} y2={82} />
      <L x1={36} y1={58} x2={44} y2={58} />
      <L x1={76} y1={58} x2={84} y2={58} />
      <Dot cx={60} cy={58} r={2.8} />
    </Vector>
  )
}

export function TrimVector() {
  return (
    <Vector>
      <Ghost opacity={0.35}>
        <R x={10} y={44} width={100} height={32} rx={5} />
      </Ghost>
      <R x={28} y={38} width={7} height={44} rx={3} />
      <R x={85} y={38} width={7} height={44} rx={3} />
      <Ghost opacity={0.5}>
        <L x1={44} y1={54} x2={44} y2={66} />
        <L x1={54} y1={50} x2={54} y2={70} />
        <L x1={64} y1={56} x2={64} y2={64} />
        <L x1={74} y1={49} x2={74} y2={71} />
      </Ghost>
    </Vector>
  )
}

export function RenderVector() {
  return (
    <Vector>
      <R x={18} y={24} width={84} height={46} rx={7} />
      <Ghost opacity={0.4}>
        <L x1={38} y1={24} x2={38} y2={70} />
        <L x1={82} y1={24} x2={82} y2={70} />
      </Ghost>
      <L x1={60} y1={74} x2={60} y2={100} />
      <P d="M49 89 L60 100 L71 89" />
    </Vector>
  )
}

export function ClipboardVector() {
  return (
    <Vector>
      <R x={30} y={24} width={60} height={76} rx={8} />
      <R x={48} y={16} width={24} height={14} rx={4} />
      <Ghost opacity={0.45}>
        <L x1={44} y1={54} x2={76} y2={54} />
        <L x1={44} y1={66} x2={68} y2={66} />
        <L x1={44} y1={78} x2={72} y2={78} />
      </Ghost>
    </Vector>
  )
}

export function ShareVector() {
  return (
    <Vector>
      <Ghost opacity={0.45}>
        <L x1={38} y1={44} x2={80} y2={56} />
        <L x1={38} y1={78} x2={80} y2={66} />
      </Ghost>
      <C cx={30} cy={40} r={9} />
      <C cx={30} cy={82} r={9} />
      <C cx={88} cy={61} r={9} />
    </Vector>
  )
}

export function MultiDeviceVector() {
  return (
    <Vector>
      <R x={6} y={32} width={56} height={38} rx={5} />
      <L x1={2} y1={76} x2={66} y2={76} />
      <Ghost opacity={0.5}>
        <R x={70} y={28} width={30} height={46} rx={5} />
        <L x1={81} y1={69} x2={89} y2={69} />
      </Ghost>
      <Ghost opacity={0.35}>
        <R x={104} y={40} width={13} height={34} rx={4} />
      </Ghost>
    </Vector>
  )
}

export function CompareVector() {
  return (
    <Vector>
      <R x={8} y={26} width={44} height={62} rx={6} />
      <Ghost opacity={0.45}>
        <L x1={18} y1={44} x2={42} y2={44} />
        <L x1={18} y1={56} x2={36} y2={56} />
      </Ghost>
      <Ghost opacity={0.5}>
        <R x={68} y={26} width={44} height={62} rx={6} />
        <L x1={78} y1={44} x2={102} y2={44} />
        <L x1={78} y1={56} x2={96} y2={56} />
      </Ghost>
      <Ghost opacity={0.4}>
        <L x1={60} y1={16} x2={60} y2={98} />
      </Ghost>
      <C cx={60} cy={57} r={7} />
    </Vector>
  )
}

export function AnnounceVector() {
  return (
    <Vector>
      <Ghost opacity={0.35}>
        <R x={8} y={32} width={64} height={52} rx={7} />
      </Ghost>
      <R x={20} y={46} width={34} height={24} rx={4} />
      <Ghost opacity={0.6}>
        <L x1={82} y1={44} x2={92} y2={34} />
        <L x1={86} y1={58} x2={100} y2={58} />
        <L x1={82} y1={72} x2={92} y2={82} />
      </Ghost>
    </Vector>
  )
}

export function WalkthroughVector() {
  return (
    <Vector>
      <Ghost opacity={0.45}>
        <P d="M14 94 C 40 94, 44 58, 60 58 S 88 26, 106 26" />
      </Ghost>
      <C cx={14} cy={94} r={6} />
      <C cx={60} cy={58} r={7} />
      <Dot cx={60} cy={58} r={2.4} />
      <C cx={106} cy={26} r={6} />
    </Vector>
  )
}
