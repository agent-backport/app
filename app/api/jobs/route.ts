import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listJobsForUser, getJob } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get("id");

  // If a specific job ID is requested
  if (jobId) {
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    // TODO: Verify user has access to this job's repository
    return NextResponse.json(job);
  }

  // List all jobs the user has access to
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const jobs = await listJobsForUser(session.accessToken, limit);

  return NextResponse.json({ jobs });
}
