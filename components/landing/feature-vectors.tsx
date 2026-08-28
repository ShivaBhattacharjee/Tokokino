"use client"

import type { ComponentProps, ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { ease } from "@/components/landing/constants"

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
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
  hidden: { opacity: 0, scale: 0.75 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease },
  },
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
type DotProps = Omit<ComponentProps<typeof motion.circle>, "cx" | "cy"> & {
  cx: number
  cy: number
}

const Dot = ({ cx, cy, ...props }: DotProps) => (
  <motion.circle
    variants={solid}
    cx={cx}
    cy={cy}
    fill="currentColor"
    stroke="none"
    style={{ transformOrigin: `${cx}px ${cy}px` }}
    {...props}
  />
)
const AccentP = (props: ComponentProps<typeof motion.path>) => (
  <motion.path className="text-primary/75" variants={stroke} {...props} />
)
const AccentC = (props: ComponentProps<typeof motion.circle>) => (
  <motion.circle className="text-primary/75" variants={stroke} {...props} />
)
const AccentR = (props: ComponentProps<typeof motion.rect>) => (
  <motion.rect className="text-primary/75" variants={stroke} {...props} />
)

export function DeviceFramesVector() {
  return (
    <Vector>
      <R x={8} y={28} width={66} height={54} rx={7} />
      <L x1={8} y1={42} x2={74} y2={42} />
      <Dot cx={18} cy={35} r={1.5} />
      <Dot cx={24} cy={35} r={1.5} />
      <Ghost opacity={0.55}>
        <R x={82} y={34} width={30} height={66} rx={8} />
        <L x1={92} y1={42} x2={102} y2={42} />
      </Ghost>
      <AccentP d="M17 72 L30 59 L42 68 L54 55 L67 67" />
    </Vector>
  )
}

export function AutoPalettesVector() {
  return (
    <Vector>
      <C cx={60} cy={60} r={43} />
      <Ghost opacity={0.45}>
        <C cx={47} cy={43} r={8} />
        <C cx={72} cy={40} r={8} />
        <C cx={82} cy={64} r={8} />
        <C cx={40} cy={70} r={8} />
      </Ghost>
      <Dot cx={47} cy={43} r={3} opacity={0.35} />
      <Dot cx={72} cy={40} r={3} opacity={0.55} />
      <Dot cx={82} cy={64} r={3} className="text-primary/75" />
      <AccentC cx={82} cy={64} r={12} />
    </Vector>
  )
}

export function ShadowsEffectsVector() {
  return (
    <Vector>
      <Ghost opacity={0.18}>
        <R x={31} y={35} width={62} height={48} rx={8} />
      </Ghost>
      <Ghost opacity={0.36}>
        <R x={25} y={29} width={62} height={48} rx={8} />
      </Ghost>
      <AccentR x={19} y={23} width={62} height={48} rx={8} />
    </Vector>
  )
}

export function DepthFocusVector() {
  return (
    <Vector>
      <Ghost opacity={0.2}>
        <C cx={60} cy={60} r={48} />
      </Ghost>
      <Ghost opacity={0.4}>
        <C cx={60} cy={60} r={36} />
      </Ghost>
      <C cx={60} cy={60} r={24} />
      <R x={48} y={50} width={24} height={20} rx={5} />
      <AccentC cx={60} cy={60} r={5} />
      <AccentP d="M60 17 V25 M60 95 V103 M17 60 H25 M95 60 H103" />
    </Vector>
  )
}

export function LayersAssetsVector() {
  return (
    <Vector>
      <Ghost opacity={0.25}>
        <P d="M60 18 L104 40 L60 62 L16 40 Z" />
      </Ghost>
      <P d="M16 56 L60 78 L104 56" />
      <P d="M16 73 L60 95 L104 73" />
      <AccentP d="M60 18 L104 40 L60 62 L16 40 Z" />
      <Dot cx={60} cy={40} r={3} className="text-primary/75" />
    </Vector>
  )
}

export function AnnotationsTextVector() {
  return (
    <Vector>
      <R x={16} y={23} width={70} height={74} rx={8} />
      <L x1={29} y1={43} x2={70} y2={43} />
      <L x1={29} y1={56} x2={63} y2={56} />
      <Ghost opacity={0.5}>
        <L x1={29} y1={69} x2={52} y2={69} />
      </Ghost>
      <AccentP d="M106 93 L73 59" />
      <AccentP d="M73 59 L86 62 M73 59 L77 72" />
    </Vector>
  )
}

export function MultiShotLayoutsVector() {
  return (
    <Vector>
      <Ghost opacity={0.4}>
        <R x={10} y={34} width={38} height={50} rx={6} />
        <R x={72} y={34} width={38} height={50} rx={6} />
      </Ghost>
      <R x={40} y={25} width={40} height={66} rx={7} />
      <AccentP d="M51 67 L59 58 L68 67" />
      <AccentC cx={61} cy={48} r={4} />
    </Vector>
  )
}

export function StarterTemplatesVector() {
  return (
    <Vector>
      <R x={13} y={16} width={94} height={88} rx={10} />
      <L x1={13} y1={45} x2={107} y2={45} />
      <L x1={48} y1={45} x2={48} y2={104} />
      <Ghost opacity={0.45}>
        <R x={23} y={25} width={20} height={11} rx={3} />
        <R x={58} y={57} width={37} height={34} rx={5} />
      </Ghost>
      <AccentP d="M23 65 L23 83 L39 74 Z" />
    </Vector>
  )
}

export function XPostsVector() {
  return (
    <Vector>
      <R x={13} y={18} width={94} height={84} rx={12} />
      <C cx={34} cy={41} r={9} />
      <L x1={51} y1={36} x2={86} y2={36} />
      <Ghost opacity={0.5}>
        <L x1={51} y1={47} x2={74} y2={47} />
        <L x1={27} y1={67} x2={89} y2={67} />
        <L x1={27} y1={78} x2={78} y2={78} />
      </Ghost>
      <AccentP d="M84 26 L96 42 M96 26 L84 42" />
    </Vector>
  )
}

export function BlueskyPostsVector() {
  return (
    <Vector>
      <R x={13} y={18} width={94} height={84} rx={12} />
      <C cx={34} cy={41} r={9} />
      <L x1={51} y1={36} x2={82} y2={36} />
      <Ghost opacity={0.5}>
        <L x1={51} y1={47} x2={72} y2={47} />
        <L x1={27} y1={72} x2={89} y2={72} />
        <L x1={27} y1={83} x2={69} y2={83} />
      </Ghost>
      <AccentP d="M84 29 C78 24 74 26 77 34 C79 39 84 42 88 44 C92 42 97 39 99 34 C102 26 98 24 92 29 L88 35 Z" />
    </Vector>
  )
}

export function CaptureUrlVector() {
  return (
    <Vector>
      <R x={10} y={18} width={100} height={84} rx={9} />
      <L x1={10} y1={39} x2={110} y2={39} />
      <Dot cx={20} cy={28.5} r={1.5} />
      <Dot cx={26} cy={28.5} r={1.5} />
      <R x={35} y={25} width={58} height={7} rx={3.5} />

      <Ghost opacity={0.45}>
        <R x={26} y={49} width={68} height={38} rx={5} />
        <R x={32} y={56} width={21} height={17} rx={3} />
        <L x1={60} y1={57} x2={85} y2={57} />
        <L x1={60} y1={64} x2={80} y2={64} />
        <L x1={32} y1={79} x2={85} y2={79} />
      </Ghost>

      <AccentP d="M22 58 V48 H32 M88 48 H98 V58 M22 78 V88 H32 M88 88 H98 V78" />
      <AccentC cx={60} cy={68} r={5} />
      <Dot cx={60} cy={68} r={1.8} className="text-primary/75" />
    </Vector>
  )
}

export function TimelineDemosVector() {
  return (
    <Vector>
      <L x1={12} y1={67} x2={108} y2={67} />
      <Ghost opacity={0.45}>
        <C cx={31} cy={67} r={6} />
        <C cx={89} cy={67} r={6} />
      </Ghost>
      <AccentC cx={60} cy={67} r={9} />
      <Dot cx={60} cy={67} r={2.5} className="text-primary/75" />
      <P d="M52 26 L52 46 L70 36 Z" />
      <AccentP d="M60 55 V82" />
      <Ghost opacity={0.5}>
        <L x1={31} y1={81} x2={31} y2={90} />
        <L x1={89} y1={81} x2={89} y2={90} />
      </Ghost>
    </Vector>
  )
}

export function CustomPresetsVector() {
  return (
    <Vector>
      <L x1={17} y1={32} x2={103} y2={32} />
      <L x1={17} y1={60} x2={103} y2={60} />
      <L x1={17} y1={88} x2={103} y2={88} />
      <C cx={42} cy={32} r={7} />
      <C cx={77} cy={60} r={7} />
      <C cx={55} cy={88} r={7} />
      <AccentP d="M94 77 V103 L101 97 L108 103 V77 Z" />
    </Vector>
  )
}

export function BulkEditPreviewVector() {
  return (
    <Vector>
      <Ghost opacity={0.55}>
        <R x={14} y={17} width={36} height={32} rx={5} />
        <R x={70} y={17} width={36} height={32} rx={5} />
        <R x={14} y={67} width={36} height={32} rx={5} />
        <R x={70} y={67} width={36} height={32} rx={5} />
      </Ghost>
      <AccentP d="M35 58 C47 45 73 45 85 58 C73 71 47 71 35 58 Z" />
      <AccentC cx={60} cy={58} r={6} />
      <Dot cx={60} cy={58} r={2} className="text-primary/75" />
    </Vector>
  )
}

export function LocalFirstVector() {
  return (
    <Vector>
      <R x={21} y={15} width={78} height={90} rx={10} />
      <L x1={21} y1={35} x2={99} y2={35} />
      <Dot cx={31} cy={25} r={1.5} />
      <Dot cx={37} cy={25} r={1.5} />
      <Ghost opacity={0.45}>
        <C cx={60} cy={68} r={22} />
      </Ghost>
      <AccentP d="M60 48 V67 M52 59 L60 67 L68 59" />
      <AccentP d="M47 79 H73" />
    </Vector>
  )
}

export function ExportAnywhereVector() {
  return (
    <Vector>
      <Ghost opacity={0.45}>
        <R x={18} y={53} width={84} height={51} rx={8} />
      </Ghost>
      <AccentP d="M60 78 V17 M47 30 L60 17 L73 30" />
      <L x1={32} y1={89} x2={50} y2={89} />
      <L x1={70} y1={89} x2={88} y2={89} />
      <Dot cx={60} cy={89} r={2.5} />
    </Vector>
  )
}

export function ShareLinksVector() {
  return (
    <Vector>
      <P d="M48 72 L40 80 C31 89 17 75 26 66 L39 53 C47 45 58 48 63 56" />
      <P d="M72 48 L80 40 C89 31 103 45 94 54 L81 67 C73 75 62 72 57 64" />
      <AccentP d="M45 75 L75 45" />
      <Ghost opacity={0.45}>
        <L x1={22} y1={99} x2={44} y2={99} />
        <L x1={52} y1={91} x2={69} y2={91} />
        <L x1={77} y1={82} x2={99} y2={82} />
      </Ghost>
    </Vector>
  )
}

export function WorksOfflineVector() {
  return (
    <Vector>
      <Ghost opacity={0.5}>
        <P d="M29 68 H88 C99 68 104 60 101 51 C99 43 91 40 84 42 C80 29 69 21 57 24 C45 26 38 36 39 48 C30 47 22 53 22 61 C22 64 25 67 29 68 Z" />
      </Ghost>
      <AccentP d="M25 25 L96 96" />
      <R x={39} y={74} width={42} height={30} rx={6} />
      <L x1={52} y1={96} x2={68} y2={96} />
    </Vector>
  )
}
