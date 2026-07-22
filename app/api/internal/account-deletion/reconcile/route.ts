import { NextResponse } from "next/server"

import { reconcileStaleAccountDeletions } from "@/lib/account-management"
import { env } from "@/lib/env"

export const runtime = "nodejs"

/**
 * Internal endpoint driven by the cron `scheduled` handler in `worker.ts`.
 * Retries deletion flags that have gone stale so a dropped or dead-lettered
 * job cannot lock an account out forever. Guarded by the server-only secret.
 */
export async function POST(request: Request) {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await reconcileStaleAccountDeletions()
  return NextResponse.json({ ok: true, ...result })
}
