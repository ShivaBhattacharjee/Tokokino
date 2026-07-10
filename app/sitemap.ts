import type { MetadataRoute } from "next"

const SITE_URL = "https://tokokino.com"
const LAST_MODIFIED = new Date("2026-05-21")

const routes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/app", changeFrequency: "monthly", priority: 0.9 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/dpa", changeFrequency: "yearly", priority: 0.4 },
] as const satisfies ReadonlyArray<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}>

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: new URL(route.path, SITE_URL).toString(),
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
