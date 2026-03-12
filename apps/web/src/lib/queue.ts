import { getRequiredRedisClient } from "@/lib/redis";

export const redis = getRequiredRedisClient();

export async function pushJudgeJob(payload: Record<string, unknown>) {
  await redis.xadd("judge:jobs", "*", "payload", JSON.stringify(payload));
}
