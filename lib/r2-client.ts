import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"

let client: S3Client | null = null

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
    requestHandler: {
      connectionTimeout: 5000,
      requestTimeout: 20000,
      httpsAgent: {
        keepAlive: true,
        maxSockets: 25,
      },
    },
  })

  return client
}
