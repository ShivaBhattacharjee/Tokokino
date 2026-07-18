import "server-only"

import { S3Client } from "@aws-sdk/client-s3"
import {
  FetchHttpHandler,
  streamCollector as collectWebStream,
} from "@smithy/fetch-http-handler"

import { requireR2Config } from "@/lib/env"
import { R2_STREAM_REQUEST_TIMEOUT_MS } from "@/lib/r2-request-timeout"

let client: S3Client | null = null

type R2StreamCollector = (stream: unknown) => Promise<Uint8Array>

/**
 * The application runs the AWS SDK's Node build, but deliberately sends R2
 * requests through fetch. Depending on where Next handles a route, a response
 * body can therefore be either a Web ReadableStream or a Node Readable. The
 * SDK's built-in collectors support only one of those shapes.
 */
const collectR2Response: R2StreamCollector = async (stream) => {
  if (stream instanceof Uint8Array) return stream
  if (stream instanceof ArrayBuffer) return new Uint8Array(stream)
  if (ArrayBuffer.isView(stream)) {
    return new Uint8Array(stream.buffer, stream.byteOffset, stream.byteLength)
  }
  if (
    stream &&
    typeof stream === "object" &&
    typeof (stream as { getReader?: unknown }).getReader === "function"
  ) {
    return collectWebStream(stream)
  }
  if (
    stream &&
    typeof stream === "object" &&
    typeof (stream as { arrayBuffer?: unknown }).arrayBuffer === "function"
  ) {
    return new Uint8Array(
      await (
        stream as { arrayBuffer: () => Promise<ArrayBuffer> }
      ).arrayBuffer()
    )
  }
  if (stream && typeof stream === "object" && Symbol.asyncIterator in stream) {
    const chunks: Uint8Array[] = []
    let byteLength = 0
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      chunks.push(bytes)
      byteLength += bytes.byteLength
    }
    const result = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.byteLength
    }
    return result
  }
  throw new TypeError("Unsupported R2 response body")
}

export function getR2Client() {
  if (client) return client

  const config = requireR2Config()
  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    maxAttempts: 3,
    retryMode: "standard",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: new FetchHttpHandler({
      requestTimeout: R2_STREAM_REQUEST_TIMEOUT_MS,
    }),
    streamCollector: collectR2Response,
  })

  return client
}
