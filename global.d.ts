/// <reference types="@cloudflare/workers-types" />

declare module "*.css"

declare global {
  interface CloudflareEnv {
    TOKOKINO_DB?: D1Database
  }
}

export {}
