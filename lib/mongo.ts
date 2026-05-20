import { MongoClient, type MongoClientOptions } from "mongodb"

import { env } from "@/lib/env"

const globalForMongo = globalThis as unknown as {
  mongoClient?: MongoClient
  mongoClientPromise?: Promise<MongoClient>
}

const mongoClientOptions: MongoClientOptions = {
  connectTimeoutMS: 10000,
  maxConnecting: 2,
  maxIdleTimeMS: 60000,
  maxPoolSize: 20,
  minPoolSize: 0,
  serverMonitoringMode: "poll",
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  waitQueueTimeoutMS: 15000,
}

function getMongoUri() {
  if (!env.MONGODB_URI) {
    throw new Error("Please provide a MONGODB_URI in your environment variables")
  }
  return env.MONGODB_URI
}

export function getMongoClient() {
  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(getMongoUri(), mongoClientOptions)
  }
  return globalForMongo.mongoClient
}

export async function getConnectedMongoClient() {
  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = getMongoClient().connect().catch((error) => {
      globalForMongo.mongoClient = undefined
      globalForMongo.mongoClientPromise = undefined
      throw error
    })
  }
  return globalForMongo.mongoClientPromise
}

export function getAppDb() {
  return getMongoClient().db()
}
