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

function Vector({
  children,
  viewBox = "0 0 120 120",
}: {
  children: ReactNode
  viewBox?: string
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.svg
      viewBox={viewBox}
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
const AccentP = (props: ComponentProps<typeof motion.path>) => (
  <motion.path className="text-primary/75" variants={stroke} {...props} />
)
const AccentR = (props: ComponentProps<typeof motion.rect>) => (
  <motion.rect className="text-primary/75" variants={stroke} {...props} />
)
const AccentL = (props: ComponentProps<typeof motion.line>) => (
  <motion.line className="text-primary/75" variants={stroke} {...props} />
)
const AccentDashed = (props: ComponentProps<typeof motion.path>) => (
  <motion.path className="text-primary/75" variants={solid} {...props} />
)
const AccentDot = (props: ComponentProps<typeof motion.circle>) => (
  <motion.circle
    className="text-primary/75"
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
  arm = 4,
}: {
  x: number
  y: number
  w: number
  h: number
  arm?: number
}) {
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]

  return (
    <Ghost opacity={0.75}>
      {corners.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <AccentL x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
          <AccentL x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
        </g>
      ))}
    </Ghost>
  )
}

export function BrowserVector() {
  return (
    <Vector>
      <R x={12} y={26} width={96} height={68} rx={8} />
      <L x1={12} y1={42} x2={108} y2={42} />
      <Dot cx={21} cy={34} r={1.7} />
      <Dot cx={27} cy={34} r={1.7} />
      <AccentDot cx={33} cy={34} r={1.7} />
      <AccentR x={30} y={54} width={60} height={30} rx={5} />
      <Ghost opacity={0.5}>
        <L x1={44} y1={34} x2={96} y2={34} />
      </Ghost>
      <CropMarks x={30} y={54} w={60} h={30} arm={3} />
    </Vector>
  )
}

export function DeviceStoreVector() {
  return (
    <Vector>
      <R x={18} y={22} width={84} height={54} rx={7} />
      <Ghost opacity={0.5}>
        <L x1={32} y1={40} x2={74} y2={40} />
        <L x1={32} y1={52} x2={58} y2={52} />
      </Ghost>
      <P d="M34 88 H86" />
      <Ghost opacity={0.45}>
        <P d="M60 76 V88" />
      </Ghost>
      <AccentP d="M46 100 A14 14 0 0 1 74 100" />
      <AccentDot cx={60} cy={100} r={2.4} />
    </Vector>
  )
}

export function ServerVector() {
  return (
    <Vector>
      <Ghost opacity={0.32}>
        <R x={16} y={20} width={88} height={22} rx={6} />
      </Ghost>
      <R x={16} y={50} width={88} height={22} rx={6} />
      <Ghost opacity={0.32}>
        <R x={16} y={80} width={88} height={22} rx={6} />
      </Ghost>
      <AccentDot cx={28} cy={61} r={2.4} />
      <Ghost opacity={0.5}>
        <L x1={40} y1={61} x2={78} y2={61} />
      </Ghost>
      <AccentP d="M92 55 L98 61 L92 67" />
    </Vector>
  )
}

export function BoundaryVector() {
  return (
    <Vector>
      <Ghost opacity={0.3}>
        <P d="M42 32 A12 12 0 0 1 66 28 A10 10 0 0 1 78 40 H46 A8 8 0 0 1 42 32 Z" />
      </Ghost>
      <AccentP d="M55 45 L65 55 M65 45 L55 55" />
      {/* 96 units = 10 dashes of 6 + 9 gaps of 4, so neither end is clipped. */}
      <AccentDashed d="M12 62 H108" strokeDasharray="6 4" />
      <P d="M60 74 V66 M55.5 70.5 L60 66 L64.5 70.5" />
      <R x={24} y={76} width={72} height={32} rx={6} />
      <Ghost opacity={0.5}>
        <L x1={36} y1={88} x2={72} y2={88} />
        <L x1={36} y1={98} x2={58} y2={98} />
      </Ghost>
    </Vector>
  )
}

export function MotionVector() {
  return (
    <Vector>
      <R x={14} y={16} width={92} height={54} rx={8} />
      <AccentP d="M58 32 L58 54 L78 43 Z" />
      <Ghost opacity={0.45}>
        <P d="M48 30 A18 18 0 0 0 48 56" />
      </Ghost>
      <Ghost opacity={0.3}>
        <P d="M42 24 A24 24 0 0 0 42 62" />
      </Ghost>
      <Ghost opacity={0.18}>
        <P d="M36 20 A30 30 0 0 0 36 66" />
      </Ghost>
      <L x1={14} y1={92} x2={106} y2={92} />
      <AccentR x={22} y={84} width={38} height={16} rx={4} />
      <Ghost opacity={0.45}>
        <R x={66} y={84} width={26} height={16} rx={4} />
      </Ghost>
      <Ghost opacity={0.5}>
        {[14, 37, 60, 83, 106].map((x) => (
          <L key={x} x1={x} y1={104} x2={x} y2={110} />
        ))}
      </Ghost>
    </Vector>
  )
}

export function OpenSourceVector() {
  return (
    <Vector>
      <L x1={38} y1={16} x2={38} y2={104} />
      <C cx={38} cy={26} r={5} />
      <AccentDot cx={38} cy={26} r={2.2} />
      <C cx={38} cy={60} r={5} />
      <C cx={38} cy={98} r={5} />
      <AccentP d="M38 44 C 62 44, 78 44, 78 30" />
      <AccentP d="M38 76 C 58 76, 72 76, 72 90" />
      <C cx={78} cy={24} r={5} className="text-primary/75" />
      <Ghost opacity={0.5}>
        <C cx={72} cy={96} r={5} />
      </Ghost>
    </Vector>
  )
}

export function SoloVector() {
  return (
    <Vector>
      <Ghost opacity={0.18}>
        <C cx={60} cy={60} r={44} />
      </Ghost>
      <Ghost opacity={0.3}>
        <C cx={60} cy={60} r={32} />
      </Ghost>
      <C cx={60} cy={60} r={20} />
      <AccentDot cx={60} cy={60} r={4} />
      <Ghost opacity={0.5}>
        <L x1={60} y1={8} x2={60} y2={20} />
        <L x1={60} y1={100} x2={60} y2={112} />
        <L x1={8} y1={60} x2={20} y2={60} />
        <L x1={100} y1={60} x2={112} y2={60} />
      </Ghost>
    </Vector>
  )
}

export function PresetVector() {
  return (
    <Vector>
      <Ghost opacity={0.28}>
        <R x={16} y={18} width={40} height={30} rx={5} />
      </Ghost>
      <AccentR x={16} y={58} width={40} height={30} rx={5} />
      <R x={70} y={18} width={34} height={30} rx={5} />
      <R x={70} y={58} width={34} height={30} rx={5} />
      <Ghost opacity={0.5}>
        <P d="M60 33 H66" />
        <P d="M60 73 H66" />
      </Ghost>
      <AccentP d="M36 48 V58 M31 53 L36 58 L41 53" />
    </Vector>
  )
}

const FAN_X = 452
const FAN_UP = `M${FAN_X} 101 C 468 93, 482 62, 496 62`
const FAN_MID = `M${FAN_X} 101 H496`
const FAN_DOWN = `M${FAN_X} 101 C 468 109, 482 140, 496 140`

const FLOW_CYCLE_S = 4.4
const FLOW_DUR = `${FLOW_CYCLE_S}s`
// One speed for every segment, so the dots never slow down at the fan-out.
const FLOW_SPEED = 62
// Measured path lengths in viewBox units; the fan curves are cubics.
const FEED_LEN = 112
const TRUNK_LEN = 20
const FAN_CURVE_LEN = 59.86
const FAN_MID_LEN = 44

const span = (length: number) => length / FLOW_SPEED / FLOW_CYCLE_S

const FEED_START = 0.04
const FEED_END = FEED_START + span(FEED_LEN)
const TRUNK_START = FEED_END + 0.1
const TRUNK_END = TRUNK_START + span(TRUNK_LEN)
const FAN_END = TRUNK_END + span(FAN_CURVE_LEN)
const FAN_MID_END = TRUNK_END + span(FAN_MID_LEN)

const at = (value: number) => +value.toFixed(3)

function FlowDot({
  path,
  start,
  end,
}: {
  path: string
  start: number
  end: number
}) {
  const fade = 0.02

  return (
    <circle r={2.6} className="fill-primary" stroke="none" opacity={0}>
      <animateMotion
        dur={FLOW_DUR}
        repeatCount="indefinite"
        path={path}
        keyPoints="0;0;1;1"
        keyTimes={`0;${at(start)};${at(end)};1`}
        calcMode="linear"
      />
      <animate
        attributeName="opacity"
        dur={FLOW_DUR}
        repeatCount="indefinite"
        values="0;0;1;1;0;0"
        keyTimes={`0;${at(start)};${at(start + fade)};${at(end - fade)};${at(end)};1`}
      />
    </circle>
  )
}

function SplitPulse({ start }: { start: number }) {
  const keyTimes = `0;${at(start)};${at(start + 0.09)};1`

  return (
    <circle
      cx={FAN_X}
      cy={101}
      r={2}
      fill="none"
      className="stroke-primary"
      opacity={0}
    >
      <animate
        attributeName="r"
        dur={FLOW_DUR}
        repeatCount="indefinite"
        values="2;2;8;8"
        keyTimes={keyTimes}
      />
      <animate
        attributeName="opacity"
        dur={FLOW_DUR}
        repeatCount="indefinite"
        values="0;0.55;0;0"
        keyTimes={keyTimes}
      />
    </circle>
  )
}

export function AboutBannerVector() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Vector viewBox="0 0 640 200">
      <Ghost opacity={0.25}>
        <R x={28} y={54} width={76} height={54} rx={7} />
      </Ghost>
      <Ghost opacity={0.45}>
        <R x={36} y={64} width={76} height={54} rx={7} />
      </Ghost>
      <R x={44} y={74} width={76} height={54} rx={7} />
      <AccentR x={56} y={90} width={16} height={16} rx={4} />
      <Ghost opacity={0.5}>
        <L x1={80} y1={94} x2={108} y2={94} />
        <L x1={80} y1={104} x2={100} y2={104} />
      </Ghost>

      <Ghost opacity={0.55}>
        <L x1={120} y1={101} x2={232} y2={101} />
      </Ghost>
      <AccentP d="M226 96 L232 101 L226 106" />

      <R x={232} y={36} width={200} height={130} rx={14} />
      <Dot cx={246} cy={47} r={2} />
      <Dot cx={254} cy={47} r={2} />
      <AccentDot cx={262} cy={47} r={2} />
      <AccentR x={258} y={58} width={148} height={86} rx={9} />
      <CropMarks x={258} y={58} w={148} h={86} arm={6} />
      <Ghost opacity={0.5}>
        <L x1={276} y1={86} x2={344} y2={86} />
        <L x1={276} y1={100} x2={324} y2={100} />
      </Ghost>
      <Ghost opacity={0.4}>
        <L x1={276} y1={124} x2={388} y2={124} />
      </Ghost>

      <Ghost opacity={0.55}>
        <L x1={432} y1={101} x2={FAN_X} y2={101} />
        <P d={FAN_UP} />
        <P d={FAN_MID} />
        <P d={FAN_DOWN} />
      </Ghost>
      <Ghost opacity={0.7}>
        <Dot cx={FAN_X} cy={101} r={1.6} />
      </Ghost>

      <R x={496} y={47} width={112} height={30} rx={8} />
      <AccentR x={508} y={55} width={14} height={14} rx={3} />
      <Ghost opacity={0.45}>
        <L x1={532} y1={58} x2={584} y2={58} />
        <L x1={532} y1={66} x2={562} y2={66} />
      </Ghost>

      <R x={496} y={86} width={112} height={30} rx={8} />
      <AccentP d="M509 94 L509 108 L521 101 Z" />
      <Ghost opacity={0.45}>
        <L x1={532} y1={97} x2={584} y2={97} />
        <L x1={532} y1={105} x2={562} y2={105} />
      </Ghost>

      <R x={496} y={125} width={112} height={30} rx={8} />
      <AccentP d="M509 147 V139 H517 M513 143 L523 133 M517 133 H523 V139" />
      <Ghost opacity={0.45}>
        <L x1={532} y1={136} x2={584} y2={136} />
        <L x1={532} y1={144} x2={562} y2={144} />
      </Ghost>

      {shouldReduceMotion ? null : (
        <motion.g variants={solid}>
          <FlowDot path="M120 101 H232" start={FEED_START} end={FEED_END} />
          <FlowDot
            path={`M432 101 H${FAN_X}`}
            start={TRUNK_START}
            end={TRUNK_END}
          />
          <SplitPulse start={TRUNK_END} />
          <FlowDot path={FAN_UP} start={TRUNK_END} end={FAN_END} />
          <FlowDot path={FAN_MID} start={TRUNK_END} end={FAN_MID_END} />
          <FlowDot path={FAN_DOWN} start={TRUNK_END} end={FAN_END} />
        </motion.g>
      )}
    </Vector>
  )
}
