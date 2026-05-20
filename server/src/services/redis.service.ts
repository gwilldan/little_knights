import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";

export const redis = createClient({ url: redisUrl });

export async function connectRedis(): Promise<void> {
  if (redis.isOpen) {
    return;
  }

  redis.on("error", (error: unknown) => {
    console.error("Redis error", error);
  });

  await redis.connect();
}
