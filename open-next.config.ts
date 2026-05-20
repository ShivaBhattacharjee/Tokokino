import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from "@opennextjs/cloudflare"

const config: OpenNextConfig = {
  ...defineCloudflareConfig(),
  buildCommand: "pnpm run build:next",
}

export default config
