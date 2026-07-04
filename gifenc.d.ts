// Minimal ambient types for gifenc (ships no declarations).
declare module "gifenc" {
  export type Palette = number[][]

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      options?: {
        palette?: Palette
        delay?: number
        transparent?: boolean
        dispose?: number
        repeat?: number
      }
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: {
    auto?: boolean
    initialCapacity?: number
  }): GifEncoder

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>
  ): Palette

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string
  ): Uint8Array
}
