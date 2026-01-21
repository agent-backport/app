// Job storage for backport operations
// TODO: Replace with database (Vercel KV/Postgres) in Phase 8

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

// In-memory store (will be replaced with database)
const jobs = new Map<string, BackportJob>();

export function generateJobId(): string {
  return `bp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function createJob(
  params: Omit<BackportJob, "id" | "status" | "createdAt" | "updatedAt" | "logs">
): Promise<BackportJob> {
  const job: BackportJob = {
    ...params,
    id: generateJobId(),
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    logs: [],
  };

  jobs.set(job.id, job);
  return job;
}

export async function getJob(id: string): Promise<BackportJob | null> {
  return jobs.get(id) || null;
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<BackportJob, "id" | "createdAt">>
): Promise<BackportJob | null> {
  const job = jobs.get(id);
  if (!job) return null;

  const updated = {
    ...job,
    ...updates,
    updatedAt: new Date(),
  };

  jobs.set(id, updated);
  return updated;
}

export async function addJobLog(id: string, message: string): Promise<void> {
  const job = jobs.get(id);
  if (job) {
    job.logs.push(`[${new Date().toISOString()}] ${message}`);
    job.updatedAt = new Date();
  }
}

export async function listJobs(options?: {
  repository?: string;
  status?: BackportJob["status"];
  limit?: number;
}): Promise<BackportJob[]> {
  let result = Array.from(jobs.values());

  if (options?.repository) {
    result = result.filter((j) => j.repository === options.repository);
  }

  if (options?.status) {
    result = result.filter((j) => j.status === options.status);
  }

  // Sort by createdAt descending
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

export async function listJobsForUser(
  accessToken: string,
  limit?: number
): Promise<BackportJob[]> {
  // TODO: Filter by repositories the user has access to
  // For now, return all jobs
  return listJobs({ limit });
}
