export const GLASS_CARD_FRAME_ID = "glass-card"
export const GLASS_STACK_FRAME_ID = "glass-stack"
export const GLASS_STACK_2_FRAME_ID = "glass-stack-2"
export const GLASS_FRAME_PREVIEW_IMAGE_URL =
  "https://assets.tokokino.com/frames/glass-preview-v2.webp"

export const GLASS_FRAME_COLORS = ["dark", "light"] as const

export type GlassFrameColor = (typeof GLASS_FRAME_COLORS)[number]

type GlassFrameRect = {
  x: number
  y: number
  width: number
  height: number
  radius: number
  rotation?: number
}

export type GlassFrameSpec = {
  id: string
  name: string
  size: { width: number; height: number }
  aspectRatio: string
  screen: GlassFrameRect
  front: GlassFrameRect
  layers: GlassFrameRect[]
  colors: readonly GlassFrameColor[]
}

const GLASS_FRAME_SIZE = { width: 1200, height: 750 } as const
const SCREEN_INSET_X = 9
const SCREEN_INSET_Y = SCREEN_INSET_X
const SCREEN_WIDTH = GLASS_FRAME_SIZE.width - SCREEN_INSET_X * 2
const SCREEN_HEIGHT = GLASS_FRAME_SIZE.height - SCREEN_INSET_Y * 2
const FRONT_WIDTH = 1200
const FRONT_HEIGHT = 750

export const GLASS_FRAMES = [
  {
    id: GLASS_CARD_FRAME_ID,
    name: "Glass Card",
    size: GLASS_FRAME_SIZE,
    aspectRatio: "1200 / 750",
    front: {
      x: 0,
      y: 0,
      width: FRONT_WIDTH,
      height: FRONT_HEIGHT,
      radius: 20,
    },
    screen: {
      x: SCREEN_INSET_X,
      y: SCREEN_INSET_Y,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      radius: 11,
    },
    layers: [
      {
        x: -28,
        y: 28,
        width: 1208,
        height: 750,
        radius: 20,
        rotation: -0.35,
      },
    ],
    colors: GLASS_FRAME_COLORS,
  },
  {
    id: GLASS_STACK_FRAME_ID,
    name: "Glass Cascade",
    size: GLASS_FRAME_SIZE,
    aspectRatio: "1200 / 750",
    front: {
      x: 0,
      y: 0,
      width: FRONT_WIDTH,
      height: FRONT_HEIGHT,
      radius: 20,
    },
    screen: {
      x: SCREEN_INSET_X,
      y: SCREEN_INSET_Y,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      radius: 11,
    },
    layers: [
      {
        x: 28,
        y: 24,
        width: 1144,
        height: 750,
        radius: 18,
        rotation: -0.45,
      },
      {
        x: 48,
        y: 48,
        width: 1104,
        height: 750,
        radius: 16,
        rotation: 0.6,
      },
    ],
    colors: GLASS_FRAME_COLORS,
  },
  {
    id: GLASS_STACK_2_FRAME_ID,
    name: "Glass Crown",
    size: GLASS_FRAME_SIZE,
    aspectRatio: "1200 / 750",
    front: {
      x: 0,
      y: 0,
      width: FRONT_WIDTH,
      height: FRONT_HEIGHT,
      radius: 20,
    },
    screen: {
      x: SCREEN_INSET_X,
      y: SCREEN_INSET_Y,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      radius: 11,
    },
    layers: [
      {
        x: 28,
        y: -14,
        width: 1144,
        height: 730,
        radius: 18,
        rotation: 0.45,
      },
      {
        x: 48,
        y: -44,
        width: 1104,
        height: 700,
        radius: 16,
        rotation: -0.6,
      },
    ],
    colors: GLASS_FRAME_COLORS,
  },
] as const satisfies readonly GlassFrameSpec[]

export type GlassFrameId = (typeof GLASS_FRAMES)[number]["id"]

export function getGlassFrame(id: string): GlassFrameSpec | null {
  return GLASS_FRAMES.find((frame) => frame.id === id) ?? null
}

export function isGlassFrame(id: string): id is GlassFrameId {
  return getGlassFrame(id) !== null
}

export function resolveGlassFrameColor(color: string): GlassFrameColor {
  return color === "light" ? "light" : "dark"
}

export function glassFrameScreenAspect(frameId: string): number | null {
  const frame = getGlassFrame(frameId)
  return frame ? frame.screen.width / frame.screen.height : null
}
