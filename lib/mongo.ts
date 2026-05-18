import { MongoClient } from "mongodb"

import { env } from "@/lib/env"

const mongoUri = env.MONGODB_URI

if (!mongoUri) {
  throw new Error("Please provide a MONGODB_URI in your environment variables")
}

const globalForMongo = globalThis as unknown as {
  mongoClient?: MongoClient
  mongoClientPromise?: Promise<MongoClient>
}

export function getMongoClient() {
  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(mongoUri!)
  }
  return globalForMongo.mongoClient
}

export async function getConnectedMongoClient() {
  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = getMongoClient().connect()
  }
  return globalForMongo.mongoClientPromise
}

export function getAppDb() {
  return getMongoClient().db()
}
