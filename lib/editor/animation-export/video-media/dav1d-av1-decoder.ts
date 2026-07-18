/**
 * AV1 fallback decoder for browsers whose WebCodecs implementation cannot
 * decode AV1 (notably WebKit without an AV1 hardware decoder).
 *
 * The pinned, browser-only artifact is built from dav1d at -O2 with no SIMD.
 * Registering it with Mediabunny keeps the rest of the export pipeline on its
 * deterministic frame iterator instead of falling back to DOM video capture.
 */

import {
  CustomVideoDecoder,
  registerDecoder,
  VideoSample,
  type EncodedPacket,
  type VideoCodec,
} from "mediabunny"

const dav1dWasmUrl = new URL(
  "./dav1d-wasm/decoder.wasm",
  import.meta.url
).toString()

type Dav1dPlane = {
  bytes: Uint8Array
  stride: number
}

type Dav1dFrame = {
  packetId: number
  format: {
    width: number
    height: number
    chromaWidth: number
    chromaHeight: number
    cropLeft: number
    cropTop: number
    cropWidth: number
    cropHeight: number
    displayWidth: number
    displayHeight: number
  }
  y: Dav1dPlane
  u: Dav1dPlane
  v: Dav1dPlane
}

type Dav1dDecoder = {
  frameBuffer: Dav1dFrame | null
  init: (done: () => void) => void
  processFrame: (data: Uint8Array | null, done: (ok: boolean) => void) => void
  setPacketId: (packetId: number) => void
  recycleFrame: (frame: Dav1dFrame) => void
  close: () => void
  _ogv_video_decoder_destroy?: () => void
}

let registered = false

const isSupportedAv1Profile = (config: VideoDecoderConfig) =>
  // The bundled dav1d bridge only emits WebCodecs I420 frames, i.e. profile-0,
  // 8-bit, non-monochrome 4:2:0. The AV1 codec string is
  // `av01.P.LLT.DD[.M.CCC…]`; the chroma fields are optional and default to
  // 4:2:0 when absent. Accept the short form, or the extended form only when it
  // declares monochrome=0 and 4:2:0 subsampling (CCC starting "11"). Reject
  // monochrome and 4:2:2 / 4:4:4 configs the bridge cannot turn into I420.
  /^av01\.0\.\d{2}[MH]\.08(?:\.0\.11\d.*)?$/.test(config.codec)

const copyPlane = (
  source: Dav1dPlane,
  sourceWidth: number,
  height: number,
  target: Uint8Array,
  offset: number
) => {
  for (let row = 0; row < height; row++) {
    const start = row * source.stride
    target.set(
      source.bytes.subarray(start, start + sourceWidth),
      offset + row * sourceWidth
    )
  }
}

const toVideoFrame = (
  frame: Dav1dFrame,
  packet: Pick<EncodedPacket, "timestamp" | "duration">,
  colorSpace?: VideoColorSpaceInit
) => {
  const { format } = frame
  const yBytes = format.width * format.height
  const uBytes = format.chromaWidth * format.chromaHeight
  const bytes = new Uint8Array(yBytes + uBytes * 2)

  copyPlane(frame.y, format.width, format.height, bytes, 0)
  copyPlane(frame.u, format.chromaWidth, format.chromaHeight, bytes, yBytes)
  copyPlane(
    frame.v,
    format.chromaWidth,
    format.chromaHeight,
    bytes,
    yBytes + uBytes
  )

  return new VideoFrame(bytes, {
    format: "I420",
    codedWidth: format.width,
    codedHeight: format.height,
    layout: [
      { offset: 0, stride: format.width },
      { offset: yBytes, stride: format.chromaWidth },
      { offset: yBytes + uBytes, stride: format.chromaWidth },
    ],
    visibleRect: {
      x: format.cropLeft,
      y: format.cropTop,
      width: format.cropWidth,
      height: format.cropHeight,
    },
    displayWidth: format.displayWidth,
    displayHeight: format.displayHeight,
    timestamp: Math.round(packet.timestamp * 1_000_000),
    duration: Math.round(packet.duration * 1_000_000),
    colorSpace,
  })
}

class Dav1dAv1Decoder extends CustomVideoDecoder {
  static supports(codec: VideoCodec, config: VideoDecoderConfig) {
    return (
      codec === "av1" &&
      typeof VideoFrame !== "undefined" &&
      isSupportedAv1Profile(config)
    )
  }

  private decoder: Dav1dDecoder | null = null
  private packetCount = 0
  private packetTiming = new Map<
    number,
    Pick<EncodedPacket, "timestamp" | "duration">
  >()

  async init() {
    const width = this.config.codedWidth
    const height = this.config.codedHeight
    if (!width || !height) {
      throw new Error("The AV1 track has no coded dimensions")
    }

    // Keep both the JavaScript bridge and its WASM payload out of the normal
    // export chunk. This path is reached only after native AV1 decoding fails.
    const { default: createDav1dDecoder } =
      await import("./dav1d-wasm/decoder.mjs")
    const decoder = (await createDav1dDecoder({
      locateFile: () => dav1dWasmUrl,
      videoFormat: {
        width,
        height,
        chromaWidth: Math.ceil(width / 2),
        chromaHeight: Math.ceil(height / 2),
        cropLeft: 0,
        cropTop: 0,
        cropWidth: width,
        cropHeight: height,
        displayWidth: this.config.displayAspectWidth ?? width,
        displayHeight: this.config.displayAspectHeight ?? height,
      },
    })) as Dav1dDecoder

    await new Promise<void>((resolve) => decoder.init(resolve))
    this.decoder = decoder
  }

  async decode(packet: EncodedPacket) {
    const decoder = this.decoder
    if (!decoder) throw new Error("dav1d was not initialized")
    const packetIndex = ++this.packetCount
    this.packetTiming.set(packetIndex, {
      timestamp: packet.timestamp,
      duration: packet.duration,
    })
    decoder.setPacketId(packetIndex)

    const decoded = await this.processFrame(packet.data)
    if (decoded) this.emitFrame(decoded)
  }

  async flush() {
    for (;;) {
      const decoded = await this.processFrame(null)
      if (!decoded) break
      this.emitFrame(decoded)
    }
  }

  async close() {
    const decoder = this.decoder
    this.decoder = null
    this.packetTiming.clear()
    decoder?._ogv_video_decoder_destroy?.()
    decoder?.close()
  }

  private async processFrame(data: Uint8Array | null) {
    const decoder = this.decoder
    if (!decoder) throw new Error("dav1d was not initialized")

    return new Promise<Dav1dFrame | null>((resolve) => {
      decoder.processFrame(data, (ok) =>
        resolve(ok ? decoder.frameBuffer : null)
      )
    })
  }

  private emitFrame(decoded: Dav1dFrame) {
    const decoder = this.decoder
    const timing = this.packetTiming.get(decoded.packetId)
    if (!decoder) throw new Error("dav1d was not initialized")
    if (!timing) {
      decoder.recycleFrame(decoded)
      throw new Error(
        `dav1d returned a frame with unknown packet token ${decoded.packetId}`
      )
    }

    try {
      const videoFrame = toVideoFrame(decoded, timing, this.config.colorSpace)
      this.onSample(new VideoSample(videoFrame, timing))
    } finally {
      this.packetTiming.delete(decoded.packetId)
      decoder.recycleFrame(decoded)
    }
  }
}

/** Registers once, and only after native AV1 WebCodecs support was rejected. */
export const registerDav1dAv1Decoder = () => {
  if (registered) return
  registerDecoder(Dav1dAv1Decoder)
  registered = true
}
