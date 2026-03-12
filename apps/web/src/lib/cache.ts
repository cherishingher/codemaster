import { recordCacheMetric } from "@/lib/ops-metrics"
import { getRedisClient } from "@/lib/redis"

type MemoryEntry = {
  expiresAt: number
  value: string
}

declare global {
  var __webCacheMemory: Map<string, MemoryEntry> | undefined
}

function getMemoryStore() {
  if (!globalThis.__webCacheMemory) {
    globalThis.__webCacheMemory = new Map()
  }

  return globalThis.__webCacheMemory
}

async function getCachedString(key: string) {
  const redis = getRedisClient()
  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect()
      }

      const value = await redis.get(key)
      if (value != null) {
        recordCacheMetric("hit")
        return value
      }
    } catch {
      // Fall back to in-memory cache.
    }
  }

  const memoryStore = getMemoryStore()
  const memoryEntry = memoryStore.get(key)
  if (!memoryEntry) {
    recordCacheMetric("miss")
    return null
  }

  if (memoryEntry.expiresAt <= Date.now()) {
    memoryStore.delete(key)
    recordCacheMetric("miss")
    return null
  }

  recordCacheMetric("hit")
  return memoryEntry.value
}

async function setCachedString(key: string, value: string, ttlSeconds: number) {
  const redis = getRedisClient()
  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect()
      }

      await redis.set(key, value, "EX", ttlSeconds)
      return
    } catch {
      // Fall back to in-memory cache.
    }
  }

  const memoryStore = getMemoryStore()
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export async function getOrSetJsonCache<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
  const cached = await getCachedString(key)
  if (cached) {
    return JSON.parse(cached) as T
  }

  const value = await loader()
  await setCachedString(key, JSON.stringify(value), ttlSeconds)
  return value
}
