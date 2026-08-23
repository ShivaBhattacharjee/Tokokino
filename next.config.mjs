import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // These ship as barrel files; without this every page that touches one
    // icon/helper pulls the whole module graph (@remixicon alone is ~535 KB).
    optimizePackageImports: ["@remixicon/react", "lodash", "date-fns"],
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/ingest/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/ingest/array/:path*",
          destination: "https://us-assets.i.posthog.com/array/:path*",
        },
        {
          source: "/ingest/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
      ],
      fallback: [
        {
          source: "/:path*",
          has: [
            {
              type: "header",
              key: "accept",
              value: ".*text/markdown.*",
            },
          ],
          destination: "/agent-not-found",
        },
      ],
    }
  },
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Link",
            value: '</llms.txt>; rel="describedby", </sitemap.xml>; rel="sitemap", </.well-known/api-catalog>; rel="api-catalog"',
          },
        ],
      },
    ]
  },
}

export default nextConfig
