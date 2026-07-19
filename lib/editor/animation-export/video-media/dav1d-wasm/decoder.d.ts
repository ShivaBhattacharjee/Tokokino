type Dav1dDecoderOptions = {
  locateFile: (filename: string) => string
  videoFormat: {
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
}

declare const createDav1dDecoder: (
  options: Dav1dDecoderOptions
) => Promise<unknown>

export default createDav1dDecoder
