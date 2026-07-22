import { NextResponse } from "next/server"

import { processAccountDeletion } from "@/lib/account-management"
import { env } from "@/lib/env"

export const runtime = "nodejs"

/**
 * Internal endpoint invoked by the account-deletion queue consumer
 * (`worker.ts`). Running the deletion here — rather than directly in the queue
 * handler — means it executes inside the OpenNext request context, where the
 * D1 and R2 bindings resolve. Guarded by the server-only auth secret.
 */
export async function POST(request: Request) {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string
  } | null
  if (!body?.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  await processAccountDeletion(body.userId)
  return NextResponse.json({ ok: true })
}
