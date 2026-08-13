import { isIssueStale } from "./shared/logic";
import { IssueSummary, PortfolioData, RepoSummary, WorkflowHealth } from "./shared/types";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const PER_PAGE = 100;

interface RestRepo {
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  default_branch: string;
  open_issues_count: number;
  pushed_at: string;
  html_url: string;
  owner: {
    login: string;
  };
}

interface RestIssue {
  number: number;
  title: string;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
}

interface RestWorkflowRun {
  name: string;
  html_url: string;
  status: string;
  conclusion: string | null;
  updated_at: string;
}

interface RestWorkflowRunsResponse {
  workflow_runs: RestWorkflowRun[];
}

interface WorkflowSnapshot {
  health: WorkflowHealth;
  latestWorkflowName: string | null;
  latestWorkflowRunUrl: string | null;
  latestWorkflowUpdatedAt: string | null;
  latestFailedRunUrl: string | null;
}

interface JsonResponse<T> {
  data: T;
  headers: Headers;
}

export class GitHubApiError extends Error {
  status: number;
  rateLimitResetAt?: string;

  constructor(message: string, status: number, rateLimitResetAt?: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimitResetAt = rateLimitResetAt;
  }
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  async validateToken(): Promise<string> {
    const result = await this.requestJson<{ login: string }>("/user");
    return result.data.login;
  }

  async loadPortfolio(staleDays: number): Promise<PortfolioData> {
    const repos = await this.listRepos();

    const enriched = await mapWithConcurrency(repos, 5, async (repo) => {
      const [openIssues, openPrCount, workflow] = await Promise.all([
        repo.open_issues_count > 0
          ? this.listOpenIssues(repo.full_name, staleDays)
          : Promise.resolve([] as IssueSummary[]),
        this.getOpenPullRequestCount(repo.full_name),
        this.getWorkflowSnapshot(repo.full_name),
      ]);

      const staleIssues = openIssues.filter((issue) => issue.isStale);

      const summary: RepoSummary = {
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        visibility: repo.private ? "private" : "public",
        archived: repo.archived,
        defaultBranch: repo.default_branch,
        openIssueCount: openIssues.length,
        openPrCount,
        staleIssueCount: staleIssues.length,
        pushedAt: repo.pushed_at,
        repoUrl: repo.html_url,
        staleIssues,
        workflowHealth: workflow.health,
        latestWorkflowName: workflow.latestWorkflowName,
        latestWorkflowRunUrl: workflow.latestWorkflowRunUrl,
        latestWorkflowUpdatedAt: workflow.latestWorkflowUpdatedAt,
        latestFailedRunUrl: workflow.latestFailedRunUrl,
      };

      return summary;
    });

    return {
      fetchedAt: new Date().toISOString(),
      repoCount: enriched.length,
      repos: enriched,
    };
  }

  private async listRepos(): Promise<RestRepo[]> {
    const repos: RestRepo[] = [];

    for (let page = 1; ; page += 1) {
      const path =
        `/user/repos?per_page=${PER_PAGE}&page=${page}` +
        "&affiliation=owner,collaborator,organization_member" +
        "&sort=updated&direction=desc";
      const response = await this.requestJson<RestRepo[]>(path);
      repos.push(...response.data);

      if (response.data.length < PER_PAGE) {
        break;
      }
    }

    return repos;
  }

  private async listOpenIssues(fullName: string, staleDays: number): Promise<IssueSummary[]> {
    const issues: IssueSummary[] = [];

    for (let page = 1; ; page += 1) {
      const path = `/repos/${fullName}/issues?state=open&per_page=${PER_PAGE}&page=${page}`;
      const response = await this.requestJson<RestIssue[]>(path);

      for (const issue of response.data) {
        if (issue.pull_request) {
          continue;
        }
        issues.push({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          updatedAt: issue.updated_at,
          isStale: isIssueStale(issue.updated_at, staleDays),
        });
      }

      if (response.data.length < PER_PAGE) {
        break;
      }
    }

    return issues;
  }

  private async getOpenPullRequestCount(fullName: string): Promise<number> {
    const response = await this.requestJson<unknown[]>(
      `/repos/${fullName}/pulls?state=open&per_page=1&page=1`,
    );

    if (response.data.length === 0) {
      return 0;
    }

    const lastPage = parseLastPage(response.headers.get("link"));
    if (lastPage !== null) {
      return lastPage;
    }

    return response.data.length;
  }

  private async getWorkflowSnapshot(fullName: string): Promise<WorkflowSnapshot> {
    try {
      const response = await this.requestJson<RestWorkflowRunsResponse>(
        `/repos/${fullName}/actions/runs?per_page=10&page=1`,
      );

      const runs = response.data.workflow_runs ?? [];
      const latest = runs[0] ?? null;
      const latestFailed = runs.find((run) => isFailingConclusion(run.conclusion)) ?? null;

      if (!latest) {
        return emptyWorkflowSnapshot();
      }

      return {
        health: classifyWorkflowRunHealth(latest.status, latest.conclusion),
        latestWorkflowName: latest.name,
        latestWorkflowRunUrl: latest.html_url,
        latestWorkflowUpdatedAt: latest.updated_at,
        latestFailedRunUrl: latestFailed?.html_url ?? null,
      };
    } catch (error) {
      if (error instanceof GitHubApiError) {
        const message = error.message.toLowerCase();
        const actionsUnavailable =
          error.status === 404 ||
          error.status === 409 ||
          (error.status === 403 && message.includes("resource not accessible"));

        if (actionsUnavailable) {
          return emptyWorkflowSnapshot();
        }
      }

      throw error;
    }
  }

  private async requestJson<T>(path: string): Promise<JsonResponse<T>> {
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "build-buddy-electron-mvp",
      },
    });

    if (!response.ok) {
      const rawBody = await response.text();
      let parsedMessage = rawBody;

      try {
        const parsed = JSON.parse(rawBody) as { message?: string };
        parsedMessage = parsed.message ?? rawBody;
      } catch {
        // ignore JSON parse errors and fall back to raw body
      }

      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = response.headers.get("x-ratelimit-reset");
      const resetIso = reset ? new Date(Number(reset) * 1000).toISOString() : undefined;

      if (response.status === 403 && remaining === "0") {
        throw new GitHubApiError(
          `GitHub rate limit exceeded. Reset at ${resetIso ?? "unknown time"}.`,
          response.status,
          resetIso,
        );
      }

      if (response.status === 401) {
        throw new GitHubApiError("Unauthorized: token is invalid or lacks access.", 401);
      }

      throw new GitHubApiError(
        `GitHub API error (${response.status}): ${parsedMessage}`,
        response.status,
        resetIso,
      );
    }

    const data = (await response.json()) as T;
    return { data, headers: response.headers };
  }
}

function emptyWorkflowSnapshot(): WorkflowSnapshot {
  return {
    health: "unknown",
    latestWorkflowName: null,
    latestWorkflowRunUrl: null,
    latestWorkflowUpdatedAt: null,
    latestFailedRunUrl: null,
  };
}

function classifyWorkflowRunHealth(status: string, conclusion: string | null): WorkflowHealth {
  if (status && status !== "completed") {
    return "pending";
  }

  if (!conclusion) {
    return "unknown";
  }

  if (conclusion === "success") {
    return "passing";
  }

  if (isFailingConclusion(conclusion)) {
    return "failing";
  }

  return "unknown";
}

function isFailingConclusion(conclusion: string | null): boolean {
  if (!conclusion) {
    return false;
  }

  return [
    "failure",
    "timed_out",
    "cancelled",
    "action_required",
    "startup_failure",
    "stale",
  ].includes(conclusion);
}

function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) {
    return null;
  }

  const match = linkHeader.match(/[?&]page=(\d+)>; rel="last"/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) {
    throw new Error("Concurrency limit must be >= 1");
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}
