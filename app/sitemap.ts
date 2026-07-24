import type { MetadataRoute } from "next"

const SITE_URL = "https://tokokino.com"
const LAST_MODIFIED = new Date("2026-05-21")

const routes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/#features", changeFrequency: "weekly", priority: 0.8 },
  { path: "/#templates", changeFrequency: "weekly", priority: 0.8 },
  { path: "/#comparison", changeFrequency: "weekly", priority: 0.8 },
  { path: "/#use-cases", changeFrequency: "weekly", priority: 0.8 },
  { path: "/#how-it-works", changeFrequency: "weekly", priority: 0.8 },
  { path: "/#faq", changeFrequency: "weekly", priority: 0.7 },
  { path: "/#contact", changeFrequency: "weekly", priority: 0.7 },
  { path: "/showcase", changeFrequency: "weekly", priority: 0.8 },
  { path: "/app", changeFrequency: "monthly", priority: 0.9 },
  { path: "/glossary", changeFrequency: "monthly", priority: 0.5 },
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
