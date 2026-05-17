import { betterAuth } from "better-auth"
import { mongodbAdapter } from "better-auth/adapters/mongodb"
import { nextCookies } from "better-auth/next-js"
import { MongoClient } from "mongodb"

import { env } from "@/lib/env"

const mongoUri = env.MONGODB_URI

if (!mongoUri) {
  throw new Error("Please provide a MONGODB_URI in your environment variables")
}

const client = new MongoClient(mongoUri)
const db = client.db()

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [nextCookies()],
})
