import { sleep, FatalError } from "workflow";
import { getInstallationOctokit } from "@/lib/github";
import { updateJob, addJobLog } from "@/lib/jobs";

export interface BackportParams {
  jobId: string;
  installationId: number;
  repository: string;
  prNumber: number;
  targetBranch: string;
  commentId: number;
}

export interface BackportResult {
  success: boolean;
  resultPR?: number;
  error?: string;
}

/**
 * Main backport workflow
 *
 * This workflow handles the entire backport process:
 * 1. Fetch PR details and commits
 * 2. Analyze the changes and target branch
 * 3. Create a sandbox and perform git operations
 * 4. Handle any conflicts with AI assistance
 * 5. Create the result PR or report failure
 */
export async function backportPullRequest(
  params: BackportParams
): Promise<BackportResult> {
  "use workflow";

  const { jobId, installationId, repository, prNumber, targetBranch, commentId } =
    params;

  try {
    // Step 1: Acknowledge the request
    await acknowledgeRequest(installationId, repository, commentId);
    await addJobLog(jobId, "Request acknowledged");

    // Step 2: Fetch PR details
    await addJobLog(jobId, "Fetching PR details...");
    const prDetails = await fetchPRDetails(installationId, repository, prNumber);
    await addJobLog(jobId, `PR title: ${prDetails.title}`);
    await addJobLog(jobId, `Commits: ${prDetails.commits.length}`);

    // Step 3: Validate target branch exists
    await addJobLog(jobId, `Validating target branch: ${targetBranch}`);
    await validateTargetBranch(installationId, repository, targetBranch);
    await addJobLog(jobId, "Target branch exists");

    // Step 4: Analyze the changes (AI-powered)
    await addJobLog(jobId, "Analyzing changes...");
    const analysis = await analyzeChanges(prDetails, targetBranch);
    await addJobLog(jobId, `Analysis complete. Complexity: ${analysis.complexity}`);

    // Step 5: Perform the backport in a sandbox
    await addJobLog(jobId, "Performing backport in sandbox...");
    const backportResult = await performBackport(
      installationId,
      repository,
      prDetails,
      targetBranch,
      analysis
    );

    // Step 6: Create result PR or report failure
    if (backportResult.success) {
      await addJobLog(jobId, "Backport successful, creating PR...");
      const resultPR = await createBackportPR(
        installationId,
        repository,
        prNumber,
        targetBranch,
        backportResult.branch!
      );

      await reportSuccess(
        installationId,
        repository,
        prNumber,
        resultPR,
        targetBranch
      );

      await updateJob(jobId, {
        status: "completed",
        resultPR,
      });
      await addJobLog(jobId, `Backport PR created: #${resultPR}`);

      return { success: true, resultPR };
    } else {
      await addJobLog(jobId, `Backport failed: ${backportResult.error}`);
      await reportFailure(
        installationId,
        repository,
        prNumber,
        targetBranch,
        backportResult.error!
      );

      await updateJob(jobId, {
        status: "failed",
        error: backportResult.error,
      });

      return { success: false, error: backportResult.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await addJobLog(jobId, `Workflow error: ${errorMessage}`);
    await updateJob(jobId, {
      status: "failed",
      error: errorMessage,
    });

    // Re-throw to let workflow handle it
    throw error;
  }
}

// Step implementations

async function acknowledgeRequest(
  installationId: number,
  repository: string,
  commentId: number
) {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  // React to the comment to acknowledge
  await octokit.rest.reactions.createForIssueComment({
    owner,
    repo,
    comment_id: commentId,
    content: "eyes",
  });
}

async function fetchPRDetails(
  installationId: number,
  repository: string,
  prNumber: number
) {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Also get the diff for AI analysis
  const { data: diff } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: {
      format: "diff",
    },
  });

  return {
    title: pr.title,
    body: pr.body,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
    })),
    merged: pr.merged,
    mergeCommitSha: pr.merge_commit_sha,
    diff: diff as unknown as string,
  };
}

async function validateTargetBranch(
  installationId: number,
  repository: string,
  targetBranch: string
) {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  try {
    await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: targetBranch,
    });
  } catch (error) {
    throw new FatalError(`Target branch '${targetBranch}' does not exist`);
  }
}

async function analyzeChanges(prDetails: any, targetBranch: string) {
  "use step";
  // TODO: Implement AI-powered analysis in Phase 5
  // For now, return a basic analysis
  const filesChanged = (prDetails.diff?.match(/^diff --git/gm) || []).length;

  return {
    complexity: filesChanged > 10 ? "high" : filesChanged > 3 ? "medium" : "low",
    filesChanged,
    potentialConflicts: [],
    recommendations: [],
  };
}

async function performBackport(
  installationId: number,
  repository: string,
  prDetails: any,
  targetBranch: string,
  analysis: any
): Promise<{ success: boolean; branch?: string; error?: string }> {
  "use step";
  // TODO: Implement sandbox-based git operations in Phase 6
  // For now, return a placeholder error
  return {
    success: false,
    error: "Backport execution not yet implemented (coming in Phase 6)",
  };
}

async function createBackportPR(
  installationId: number,
  repository: string,
  sourcePR: number,
  targetBranch: string,
  backportBranch: string
): Promise<number> {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `[Backport ${targetBranch}] Changes from #${sourcePR}`,
    head: backportBranch,
    base: targetBranch,
    body: `This is an automated backport of #${sourcePR} to \`${targetBranch}\`.\n\nCreated by agent-backport.`,
  });

  return pr.number;
}

async function reportSuccess(
  installationId: number,
  repository: string,
  prNumber: number,
  resultPR: number,
  targetBranch: string
) {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  // Add rocket reaction to original comment
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: `✅ Successfully backported to \`${targetBranch}\`!\n\nSee #${resultPR}`,
  });
}

async function reportFailure(
  installationId: number,
  repository: string,
  prNumber: number,
  targetBranch: string,
  error: string
) {
  "use step";
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repository.split("/");

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: `❌ Failed to backport to \`${targetBranch}\`.\n\n**Error:** ${error}\n\nPlease try backporting manually.`,
  });
}
