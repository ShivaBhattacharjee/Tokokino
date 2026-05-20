import { z } from "zod/v4"

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

function isValidIpv4(hostname: string) {
  const parts = hostname.split(".")
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    const n = Number(part)
    return n >= 0 && n <= 255
  })
}

function isValidDomainHostname(hostname: string) {
  const normalized = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname
  if (!normalized || normalized.length > 253) return false
  if (normalized === "localhost") return true
  if (isValidIpv4(normalized)) return true

  const labels = normalized.split(".")
  if (labels.length < 2) return false
  if (labels.at(-1)?.match(/^\d+$/)) return false
  return labels.every((label) => HOST_LABEL_RE.test(label))
}

export const captureUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a URL")
  .transform((value, ctx) => {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid URL" })
      return z.NEVER
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "Use an http or https URL" })
      return z.NEVER
    }

    if (!isValidDomainHostname(parsed.hostname)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid domain" })
      return z.NEVER
    }

    return parsed.toString()
  })
