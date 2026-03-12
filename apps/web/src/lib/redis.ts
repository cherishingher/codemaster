import Redis from "ioredis"

declare global {
  var __webRedisClient: Redis | null | undefined
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return null
  }

  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  })
}

export function getRedisClient() {
  if (globalThis.__webRedisClient === undefined) {
    globalThis.__webRedisClient = createRedisClient()
  }

  return globalThis.__webRedisClient
}

export function getRequiredRedisClient() {
  const client = getRedisClient()
  if (!client) {
    throw new Error("REDIS_URL is not set")
  }
  return client
}

export async function pingRedis() {
  const client = getRedisClient()
  if (!client) {
    return {
      enabled: false,
      ok: false,
      message: "disabled",
    }
  }

  try {
    if (client.status === "wait") {
      await client.connect()
    }

    const result = await client.ping()
    return {
      enabled: true,
      ok: result === "PONG",
      message: result,
    }
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      message: error instanceof Error ? error.message : "redis_ping_failed",
    }
  }
}
