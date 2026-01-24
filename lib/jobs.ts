// Job storage for backport operations using Upstash Redis
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const JOB_PREFIX = "job:";
const JOB_LOGS_SUFFIX = ":logs";
const JOB_INDEX = "jobs:all";

export interface BackportJob {
  id: string;
  repository: string;
  installationId: number;
  sourcePR: number;
  targetBranch: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
  requestedBy: string;
  commentId: number;
  resultPR?: number;
  error?: string;
  logs: string[];
}

// Redis stores dates as strings, so we need this intermediate type
type RedisBackportJob = {
  id: string;
  repository: string;
  installationId: number;
  sourcePR: number;
  targetBranch: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  commentId: number;
  resultPR?: number;
  error?: string;
} & Record<string, unknown>;

function jobFromRedis(data: RedisBackportJob, logs: string[]): BackportJob {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    logs,
  };
}

function jobToRedis(
  job: Omit<BackportJob, "logs">
): Record<string, string | number> {
  return {
    id: job.id,
    repository: job.repository,
    installationId: job.installationId,
    sourcePR: job.sourcePR,
    targetBranch: job.targetBranch,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    requestedBy: job.requestedBy,
    commentId: job.commentId,
    ...(job.resultPR !== undefined && { resultPR: job.resultPR }),
    ...(job.error !== undefined && { error: job.error }),
  };
}

export function generateJobId(): string {
  return `bp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function createJob(
  params: Omit<BackportJob, "id" | "status" | "createdAt" | "updatedAt" | "logs">
): Promise<BackportJob> {
  const now = new Date();
  const job: BackportJob = {
    ...params,
    id: generateJobId(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    logs: [],
  };

  await redis.hset(`${JOB_PREFIX}${job.id}`, jobToRedis(job));
  await redis.zadd(JOB_INDEX, { score: now.getTime(), member: job.id });

  return job;
}

export async function getJob(id: string): Promise<BackportJob | null> {
  const data = await redis.hgetall<RedisBackportJob>(`${JOB_PREFIX}${id}`);
  if (!data || Object.keys(data).length === 0) return null;

  const logs = await redis.lrange<string>(
    `${JOB_PREFIX}${id}${JOB_LOGS_SUFFIX}`,
    0,
    -1
  );

  return jobFromRedis(data, logs);
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<BackportJob, "id" | "createdAt" | "logs">>
): Promise<BackportJob | null> {
  const existing = await redis.hgetall<RedisBackportJob>(`${JOB_PREFIX}${id}`);
  if (!existing || Object.keys(existing).length === 0) return null;

  const updatedData: RedisBackportJob = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await redis.hset(`${JOB_PREFIX}${id}`, updatedData);

  const logs = await redis.lrange<string>(
    `${JOB_PREFIX}${id}${JOB_LOGS_SUFFIX}`,
    0,
    -1
  );

  return jobFromRedis(updatedData, logs);
}

export async function addJobLog(id: string, message: string): Promise<void> {
  const logEntry = `[${new Date().toISOString()}] ${message}`;
  console.log(`Job ${id} log: ${message}`);

  // Push log to Redis list and update job's updatedAt
  await redis.rpush(`${JOB_PREFIX}${id}${JOB_LOGS_SUFFIX}`, logEntry);
  await redis.hset(`${JOB_PREFIX}${id}`, {
    updatedAt: new Date().toISOString(),
  });
}

export async function listJobs(options?: {
  repository?: string;
  status?: BackportJob["status"];
  limit?: number;
}): Promise<BackportJob[]> {
  const limit = options?.limit || 50;

  // Get job IDs sorted by creation time (newest first)
  const jobIds = await redis.zrange<string[]>(JOB_INDEX, 0, -1, { rev: true });

  if (jobIds.length === 0) return [];

  // Fetch all jobs in parallel
  const jobs = await Promise.all(
    jobIds.map(async (id) => {
      const job = await getJob(id);
      return job;
    })
  );

  // Filter and limit
  let result = jobs.filter((j): j is BackportJob => j !== null);

  if (options?.repository) {
    result = result.filter((j) => j.repository === options.repository);
  }

  if (options?.status) {
    result = result.filter((j) => j.status === options.status);
  }

  return result.slice(0, limit);
}

export async function listJobsForUser(
  accessToken: string,
  limit?: number
): Promise<BackportJob[]> {
  // TODO: Filter by repositories the user has access to
  // For now, return all jobs
  return listJobs({ limit });
}
