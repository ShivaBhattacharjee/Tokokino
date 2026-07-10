import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { getAuth } from "@/lib/auth"
import { env } from "@/lib/env"
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

/** Rating index → the emoji/label shown in the modal. Keep in sync with the UI. */
const RATING_META = [
  { emoji: "🤬", label: "Angry" },
  { emoji: "😐", label: "Meh" },
  { emoji: "😏", label: "Okay" },
  { emoji: "😎", label: "Good" },
  { emoji: "😍", label: "Love it" },
] as const

const feedbackSchema = z
  .object({
    // 1-based rating matching the five emoji faces (1 = angry … 5 = love it).
    rating: z.number().int().min(1).max(5).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) => data.rating !== undefined || (data.message?.length ?? 0) > 0,
    {
      message: "Provide a rating or a message.",
    }
  )

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const limited = await enforceRateLimit({
    limiter: "HEAVY_RATE_LIMITER",
    scope: "feedback",
    id: ip,
  })
  if (limited) return limited

  let parsed: z.infer<typeof feedbackSchema>
  try {
    parsed = feedbackSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 })
  }

  const webhookUrl = env.FEEDBACK_DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    // Not configured — accept silently so the UI still works in dev/self-host.
    console.warn(
      "[feedback] FEEDBACK_DISCORD_WEBHOOK_URL is not set; dropping submission"
    )
    return NextResponse.json({ ok: true })
  }

  // Attach the signed-in user's identity when available (best effort).
  let user: { name?: string | null; email?: string | null } | null = null
  try {
    const session = await getAuth().api.getSession({ headers: request.headers })
    if (session) user = { name: session.user.name, email: session.user.email }
  } catch {
    // Auth not configured or no session — feedback stays anonymous.
  }

  const rating = parsed.rating ? RATING_META[parsed.rating - 1] : null
  const who = user?.email
    ? `${user.name ?? "User"} · ${user.email}`
    : "Anonymous"

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Tokokino Feedback",
      embeds: [
        {
          title: rating ? `${rating.emoji}  ${rating.label}` : "New feedback",
          description: parsed.message || "_(no message)_",
          color: rating
            ? [0xef4444, 0xf59e0b, 0xeab308, 0x3b82f6, 0xec4899][
                parsed.rating! - 1
              ]
            : 0x6b7280,
          fields: [{ name: "From", value: who, inline: false }],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch((error) => {
    console.error("[feedback] failed to post to Discord", error)
  })

  return NextResponse.json({ ok: true })
}
