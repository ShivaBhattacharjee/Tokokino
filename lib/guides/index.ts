import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"

export type GuideAuthor = {
  name: string
  avatar?: string
}

export type Guide = {
  slug: string
  title: string
  excerpt: string
  date: string
  authors: GuideAuthor[]
  category: string
  cover: string
  body: string
  readingTime: string
}

const GUIDES_DIR = join(process.cwd(), "content", "guides")

const FEATURED_SLUG = "meet-tokokino"

function parseFrontmatter(source: string, slug: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`Guide "${slug}" is missing frontmatter`)

  const fields: Record<string, string | string[]> = {}
  let list: string[] | null = null
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/)
    if (item && list) {
      list.push(item[1].trim())
      continue
    }
    list = null
    const field = line.match(/^([A-Za-z]+):\s*(.*)$/)
    if (!field) continue
    if (field[2] === "") {
      const next: string[] = []
      fields[field[1]] = next
      list = next
    } else {
      fields[field[1]] = field[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }

  const body = match[2].trim() + "\n"
  const required = ["title", "excerpt", "date", "category", "cover"]
  for (const key of required) {
    if (typeof fields[key] !== "string" || !fields[key]) {
      throw new Error(`Guide "${slug}" is missing frontmatter "${key}"`)
    }
  }
  const authors = fields["authors"]
  if (!Array.isArray(authors) || authors.length === 0) {
    throw new Error(`Guide "${slug}" needs at least one author`)
  }

  return {
    title: fields["title"] as string,
    excerpt: fields["excerpt"] as string,
    date: fields["date"] as string,
    authors: authors.map((name) => ({ name })),
    category: fields["category"] as string,
    cover: fields["cover"] as string,
    body,
    readingTime: `${Math.max(1, Math.ceil(body.split(/\s+/).length / 200))} min`,
  }
}

function loadGuides(): Guide[] {
  return readdirSync(GUIDES_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const slug = basename(file, ".md")
      const source = readFileSync(join(GUIDES_DIR, file), "utf8")
      return { slug, ...parseFrontmatter(source, slug) }
    })
    .sort((a, b) => {
      if (a.slug === FEATURED_SLUG) return -1
      if (b.slug === FEATURED_SLUG) return 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
}

export const allGuides = loadGuides()

export function getAllGuides(): Guide[] {
  return allGuides
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return allGuides.find((g) => g.slug === slug)
}

export function getLatestGuide(): Guide | undefined {
  return allGuides[0]
}

export function formatGuideDate(date: string) {
  return new Date(date + "T12:00:00Z")
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase()
}
