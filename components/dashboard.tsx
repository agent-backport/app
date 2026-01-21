"use client";

import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface BackportJob {
  id: string;
  repository: string;
  sourcePR: number;
  targetBranch: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  resultPR?: number;
  error?: string;
  logs: string[];
}

export function Dashboard() {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<BackportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<BackportJob | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }
      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const getStatusBadge = (status: BackportJob["status"]) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };

    const labels = {
      pending: "Pending",
      in_progress: "In Progress",
      completed: "Completed",
      failed: "Failed",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Backport Jobs</h2>
          <p className="text-gray-600">
            Logged in as {session?.user?.name || session?.user?.email}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={fetchJobs}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            Refresh
          </button>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No backport jobs yet
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            To start a backport, comment on a pull request with:
            <code className="block mt-2 bg-gray-100 px-3 py-2 rounded text-sm">
              @agent-backport backport to &lt;target-branch&gt;
            </code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PR → Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedJob?.id === job.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedJob(job)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <a
                        href={`https://github.com/${job.repository}`}
                        className="hover:text-blue-600"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {job.repository}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <a
                        href={`https://github.com/${job.repository}/pull/${job.sourcePR}`}
                        className="hover:text-blue-600"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{job.sourcePR}
                      </a>
                      {" → "}
                      <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                        {job.targetBranch}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.resultPR ? (
                        <a
                          href={`https://github.com/${job.repository}/pull/${job.resultPR}`}
                          className="text-blue-600 hover:text-blue-800"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{job.resultPR}
                        </a>
                      ) : job.error ? (
                        <span className="text-red-600 truncate max-w-[150px] inline-block">
                          {job.error}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Job details panel */}
          <div className="bg-white rounded-lg shadow p-6">
            {selectedJob ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Job Details
                </h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ID</dt>
                    <dd className="text-sm text-gray-900 font-mono">
                      {selectedJob.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Requested by
                    </dt>
                    <dd className="text-sm text-gray-900">
                      @{selectedJob.requestedBy}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Created
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(selectedJob.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Updated
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(selectedJob.updatedAt)}
                    </dd>
                  </div>
                  {selectedJob.error && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Error
                      </dt>
                      <dd className="text-sm text-red-600">
                        {selectedJob.error}
                      </dd>
                    </div>
                  )}
                </dl>

                {selectedJob.logs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Logs
                    </h4>
                    <div className="bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono max-h-64 overflow-y-auto">
                      {selectedJob.logs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>Select a job to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
