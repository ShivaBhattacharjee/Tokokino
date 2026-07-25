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
