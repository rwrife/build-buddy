import { AppSettings, RepoSummary, WorkflowHealth } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isIssueStale(
  updatedAt: string,
  staleDays: number,
  now: Date = new Date(),
): boolean {
  const threshold = now.getTime() - Math.max(0, staleDays) * DAY_MS;
  return new Date(updatedAt).getTime() < threshold;
}

export function applyRepoFiltersAndSort(
  repos: RepoSummary[],
  settings: Pick<
    AppSettings,
    "visibilityFilter" | "hasOpenIssuesOnly" | "hasStaleIssuesOnly" | "sortBy"
  >,
): RepoSummary[] {
  const filtered = repos.filter((repo) => {
    if (settings.visibilityFilter === "public" && repo.visibility !== "public") {
      return false;
    }
    if (settings.visibilityFilter === "private" && repo.visibility !== "private") {
      return false;
    }
    if (settings.hasOpenIssuesOnly && repo.openIssueCount === 0) {
      return false;
    }
    if (settings.hasStaleIssuesOnly && repo.staleIssueCount === 0) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    switch (settings.sortBy) {
      case "stale_desc":
        return (
          b.staleIssueCount - a.staleIssueCount ||
          b.openIssueCount - a.openIssueCount ||
          dateToEpoch(b.pushedAt) - dateToEpoch(a.pushedAt)
        );
      case "open_issues_desc":
        return (
          b.openIssueCount - a.openIssueCount ||
          b.staleIssueCount - a.staleIssueCount ||
          dateToEpoch(b.pushedAt) - dateToEpoch(a.pushedAt)
        );
      case "last_pushed_asc":
        return dateToEpoch(a.pushedAt) - dateToEpoch(b.pushedAt);
      case "last_pushed_desc":
      default:
        return dateToEpoch(b.pushedAt) - dateToEpoch(a.pushedAt);
    }
  });

  return filtered;
}

export function mapWorkflowHealthToMood(health: WorkflowHealth):
  | "happy"
  | "sad"
  | "working"
  | "unknown" {
  switch (health) {
    case "passing":
      return "happy";
    case "failing":
      return "sad";
    case "pending":
      return "working";
    default:
      return "unknown";
  }
}

export function formatFailureBubbleMessage(
  repo: Pick<RepoSummary, "workflowHealth" | "latestFailedJobName" | "latestWorkflowName">,
): string | null {
  if (repo.workflowHealth !== "failing") {
    return null;
  }

  if (repo.latestFailedJobName && repo.latestWorkflowName) {
    return `Build failed in job “${repo.latestFailedJobName}” (${repo.latestWorkflowName}).`;
  }

  if (repo.latestFailedJobName) {
    return `Build failed in job “${repo.latestFailedJobName}”.`;
  }

  if (repo.latestWorkflowName) {
    return `Build failed in workflow “${repo.latestWorkflowName}”.`;
  }

  return "Build failed — open the latest failing run for details.";
}

function dateToEpoch(value: string): number {
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}
