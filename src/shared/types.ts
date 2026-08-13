export type VisibilityFilter = "all" | "public" | "private";

export type SortBy =
  | "stale_desc"
  | "open_issues_desc"
  | "last_pushed_desc"
  | "last_pushed_asc";

export interface AppSettings {
  token: string;
  staleDays: number;
  visibilityFilter: VisibilityFilter;
  hasOpenIssuesOnly: boolean;
  hasStaleIssuesOnly: boolean;
  sortBy: SortBy;
  autoRefreshMinutes: number;
}

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  isStale: boolean;
}

export type WorkflowHealth = "passing" | "failing" | "pending" | "unknown";

export interface RepoSummary {
  name: string;
  fullName: string;
  owner: string;
  visibility: "public" | "private";
  archived: boolean;
  defaultBranch: string;
  openIssueCount: number;
  openPrCount: number;
  staleIssueCount: number;
  pushedAt: string;
  repoUrl: string;
  staleIssues: IssueSummary[];
  workflowHealth: WorkflowHealth;
  latestWorkflowName: string | null;
  latestWorkflowRunUrl: string | null;
  latestWorkflowUpdatedAt: string | null;
  latestFailedRunUrl: string | null;
}

export interface PortfolioData {
  fetchedAt: string;
  repoCount: number;
  repos: RepoSummary[];
}
