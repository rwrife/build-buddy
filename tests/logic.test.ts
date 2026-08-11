import test from "node:test";
import assert from "node:assert/strict";

import { applyRepoFiltersAndSort, isIssueStale } from "../src/shared/logic";
import { RepoSummary } from "../src/shared/types";

const repos: RepoSummary[] = [
  {
    name: "alpha",
    fullName: "org/alpha",
    owner: "org",
    visibility: "public",
    archived: false,
    defaultBranch: "main",
    openIssueCount: 5,
    openPrCount: 2,
    staleIssueCount: 3,
    pushedAt: "2026-08-01T00:00:00Z",
    repoUrl: "https://github.com/org/alpha",
    staleIssues: [],
  },
  {
    name: "beta",
    fullName: "org/beta",
    owner: "org",
    visibility: "private",
    archived: false,
    defaultBranch: "main",
    openIssueCount: 1,
    openPrCount: 0,
    staleIssueCount: 0,
    pushedAt: "2026-07-01T00:00:00Z",
    repoUrl: "https://github.com/org/beta",
    staleIssues: [],
  },
  {
    name: "gamma",
    fullName: "org/gamma",
    owner: "org",
    visibility: "public",
    archived: false,
    defaultBranch: "main",
    openIssueCount: 9,
    openPrCount: 4,
    staleIssueCount: 1,
    pushedAt: "2026-08-05T00:00:00Z",
    repoUrl: "https://github.com/org/gamma",
    staleIssues: [],
  },
];

test("isIssueStale honors stale-day threshold", () => {
  const now = new Date("2026-08-10T00:00:00Z");
  assert.equal(isIssueStale("2026-08-09T00:00:00Z", 3, now), false);
  assert.equal(isIssueStale("2026-08-01T00:00:00Z", 3, now), true);
});

test("applyRepoFiltersAndSort filters visibility and stale-only", () => {
  const filtered = applyRepoFiltersAndSort(repos, {
    visibilityFilter: "public",
    hasOpenIssuesOnly: false,
    hasStaleIssuesOnly: true,
    sortBy: "stale_desc",
  });

  assert.deepEqual(
    filtered.map((repo) => repo.name),
    ["alpha", "gamma"],
  );
});

test("applyRepoFiltersAndSort sorts by open issues desc", () => {
  const filtered = applyRepoFiltersAndSort(repos, {
    visibilityFilter: "all",
    hasOpenIssuesOnly: false,
    hasStaleIssuesOnly: false,
    sortBy: "open_issues_desc",
  });

  assert.deepEqual(
    filtered.map((repo) => repo.name),
    ["gamma", "alpha", "beta"],
  );
});
