import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

export const redis = new Redis(redisUrl);

export async function pushJudgeJob(payload: Record<string, unknown>) {
  await redis.xadd("judge:jobs", "*", "payload", JSON.stringify(payload));
}
