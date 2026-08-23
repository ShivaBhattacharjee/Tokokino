import type { MetadataRoute } from "next"

import { COMPARISONS } from "@/lib/compare/comparisons"

const SITE_URL = "https://tokokino.com"

const LANDING_MODIFIED = "2026-07-25"
const COMPARE_MODIFIED = "2026-07-25"

const routes = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#features",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#templates",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#comparison",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#use-cases",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#how-it-works",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#faq",
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/#contact",
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: LANDING_MODIFIED,
  },
  {
    path: "/showcase",
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: "2026-07-24",
  },
  {
    path: "/app",
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: "2026-07-27",
  },
  {
    path: "/compare",
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: COMPARE_MODIFIED,
  },
  ...COMPARISONS.map(
    (comparison) =>
      ({
        path: `/compare/${comparison.slug}`,
        changeFrequency: "monthly",
        priority: 0.7,
        lastModified: COMPARE_MODIFIED,
      }) as const
  ),
  {
    path: "/glossary",
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: "2026-08-11",
  },
  {
    path: "/changelog",
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: "2026-08-09",
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: "2026-08-23",
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: "2026-08-23",
  },
  {
    path: "/privacy",
    changeFrequency: "yearly",
    priority: 0.4,
    lastModified: "2026-07-07",
  },
  {
    path: "/terms",
    changeFrequency: "yearly",
    priority: 0.4,
    lastModified: "2026-07-07",
  },
  {
    path: "/dpa",
    changeFrequency: "yearly",
    priority: 0.4,
    lastModified: "2026-07-29",
  },
] as const satisfies ReadonlyArray<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
  lastModified: string
}>

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: new URL(route.path, SITE_URL).toString(),
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
