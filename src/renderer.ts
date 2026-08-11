type VisibilityFilter = "all" | "public" | "private";
type SortBy = "stale_desc" | "open_issues_desc" | "last_pushed_desc" | "last_pushed_asc";

interface AppSettings {
  token: string;
  staleDays: number;
  visibilityFilter: VisibilityFilter;
  hasOpenIssuesOnly: boolean;
  hasStaleIssuesOnly: boolean;
  sortBy: SortBy;
  autoRefreshMinutes: number;
}

interface IssueSummary {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  isStale: boolean;
}

interface RepoSummary {
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
}

interface PortfolioData {
  fetchedAt: string;
  repoCount: number;
  repos: RepoSummary[];
}

const state: {
  allRepos: RepoSummary[];
  lastFetchedAt: string | null;
  timer: ReturnType<typeof setInterval> | null;
} = {
  allRepos: [],
  lastFetchedAt: null,
  timer: null,
};

const tokenInput = document.getElementById("token") as HTMLInputElement;
const staleDaysInput = document.getElementById("staleDays") as HTMLInputElement;
const visibilityFilterSelect = document.getElementById("visibilityFilter") as HTMLSelectElement;
const hasOpenIssuesOnlyCheckbox = document.getElementById(
  "hasOpenIssuesOnly",
) as HTMLInputElement;
const hasStaleIssuesOnlyCheckbox = document.getElementById(
  "hasStaleIssuesOnly",
) as HTMLInputElement;
const sortBySelect = document.getElementById("sortBy") as HTMLSelectElement;
const autoRefreshMinutesInput = document.getElementById(
  "autoRefreshMinutes",
) as HTMLInputElement;

const statusBanner = document.getElementById("statusBanner") as HTMLDivElement;
const metricsText = document.getElementById("metricsText") as HTMLDivElement;
const refreshButton = document.getElementById("refreshButton") as HTMLButtonElement;
const saveSettingsButton = document.getElementById("saveSettingsButton") as HTMLButtonElement;
const repoTableBody = document.getElementById("repoTableBody") as HTMLTableSectionElement;
const issueHealthBody = document.getElementById("issueHealthBody") as HTMLTableSectionElement;

const DEFAULT_SETTINGS: AppSettings = {
  token: "",
  staleDays: 30,
  visibilityFilter: "all",
  hasOpenIssuesOnly: false,
  hasStaleIssuesOnly: false,
  sortBy: "stale_desc",
  autoRefreshMinutes: 0,
};

void bootstrap();

async function bootstrap(): Promise<void> {
  wireEvents();

  try {
    const saved = await window.buildBuddyApi.getSettings();
    applySettingsToForm(saved);
    setStatus("Ready. Provide a GitHub token and click Refresh.", "info");
    configureAutoRefresh(saved.autoRefreshMinutes);

    if (saved.token) {
      await refreshPortfolio();
    }
  } catch (error) {
    setStatus(errorMessage(error), "error");
  }
}

function wireEvents(): void {
  refreshButton.addEventListener("click", () => {
    void refreshPortfolio();
  });

  saveSettingsButton.addEventListener("click", () => {
    void persistCurrentSettings();
  });

  [
    visibilityFilterSelect,
    hasOpenIssuesOnlyCheckbox,
    hasStaleIssuesOnlyCheckbox,
    sortBySelect,
  ].forEach((el) => {
    el.addEventListener("change", () => {
      render();
      void persistCurrentSettings();
    });
  });

  [staleDaysInput, autoRefreshMinutesInput].forEach((el) => {
    el.addEventListener("change", () => {
      void persistCurrentSettings();
      configureAutoRefresh(readSettingsFromForm().autoRefreshMinutes);
    });
  });

  tokenInput.addEventListener("change", () => {
    void persistCurrentSettings();
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches("button[data-url]")) {
      return;
    }

    const url = target.getAttribute("data-url");
    if (!url) {
      return;
    }
    void window.buildBuddyApi.openExternal(url);
  });
}

async function refreshPortfolio(): Promise<void> {
  const settings = readSettingsFromForm();
  if (!settings.token.trim()) {
    setStatus("GitHub token is required.", "error");
    return;
  }

  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing…";

  try {
    setStatus("Validating token…", "info");
    const { login } = await window.buildBuddyApi.validateToken(settings.token);
    setStatus(`Refreshing repo portfolio for @${login}…`, "info");

    const portfolio: PortfolioData = await window.buildBuddyApi.refreshPortfolio({
      token: settings.token,
      staleDays: settings.staleDays,
    });

    state.allRepos = portfolio.repos;
    state.lastFetchedAt = portfolio.fetchedAt;
    render();

    await persistCurrentSettings();
    setStatus(
      `Loaded ${portfolio.repoCount} repos at ${formatTimestamp(portfolio.fetchedAt)}.`,
      "success",
    );
  } catch (error) {
    setStatus(errorMessage(error), "error");
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

async function persistCurrentSettings(): Promise<void> {
  const settings = readSettingsFromForm();
  await window.buildBuddyApi.saveSettings(settings);
}

function render(): void {
  const settings = readSettingsFromForm();
  const repos = applyFiltersAndSort(state.allRepos, settings);

  renderRepoInventory(repos);
  renderIssueHealth(repos);

  const staleTotal = repos.reduce((sum, repo) => sum + repo.staleIssueCount, 0);
  const issueTotal = repos.reduce((sum, repo) => sum + repo.openIssueCount, 0);

  metricsText.textContent =
    `Showing ${repos.length} repos · ${issueTotal} open issues · ${staleTotal} stale issues` +
    (state.lastFetchedAt ? ` · Last refresh: ${formatTimestamp(state.lastFetchedAt)}` : "");
}

function renderRepoInventory(repos: RepoSummary[]): void {
  repoTableBody.replaceChildren();

  if (repos.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "No repositories match the current filters.";
    cell.className = "empty-cell";
    row.appendChild(cell);
    repoTableBody.appendChild(row);
    return;
  }

  for (const repo of repos) {
    const row = document.createElement("tr");
    row.appendChild(cellWithText(repo.fullName));
    row.appendChild(cellWithBadge(repo.visibility, repo.visibility === "public" ? "ok" : "muted"));
    row.appendChild(cellWithBadge(repo.archived ? "yes" : "no", repo.archived ? "warn" : "ok"));
    row.appendChild(cellWithText(repo.defaultBranch));
    row.appendChild(cellWithText(String(repo.openIssueCount)));
    row.appendChild(cellWithText(String(repo.openPrCount)));
    row.appendChild(cellWithText(formatDate(repo.pushedAt)));

    const actionCell = document.createElement("td");
    actionCell.appendChild(openButton("Open", repo.repoUrl));
    row.appendChild(actionCell);

    repoTableBody.appendChild(row);
  }
}

function renderIssueHealth(repos: RepoSummary[]): void {
  issueHealthBody.replaceChildren();

  const reposWithIssues = repos.filter((repo) => repo.openIssueCount > 0 || repo.staleIssueCount > 0);
  if (reposWithIssues.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No open/stale issues for visible repositories.";
    cell.className = "empty-cell";
    row.appendChild(cell);
    issueHealthBody.appendChild(row);
    return;
  }

  for (const repo of reposWithIssues) {
    const row = document.createElement("tr");
    row.appendChild(cellWithText(repo.fullName));
    row.appendChild(cellWithText(String(repo.openIssueCount)));
    row.appendChild(cellWithText(String(repo.staleIssueCount)));

    const staleCell = document.createElement("td");
    if (repo.staleIssues.length === 0) {
      staleCell.textContent = "—";
    } else {
      const top = repo.staleIssues.slice(0, 3);
      for (const issue of top) {
        const line = document.createElement("div");
        line.className = "stale-issue-row";
        line.appendChild(openButton(`#${issue.number}`, issue.url));

        const text = document.createElement("span");
        text.textContent = ` ${issue.title} (updated ${formatDate(issue.updatedAt)})`;
        line.appendChild(text);

        staleCell.appendChild(line);
      }
      if (repo.staleIssues.length > 3) {
        const more = document.createElement("div");
        more.className = "muted-small";
        more.textContent = `+${repo.staleIssues.length - 3} more stale issues`;
        staleCell.appendChild(more);
      }
    }
    row.appendChild(staleCell);

    const actionCell = document.createElement("td");
    actionCell.appendChild(openButton("Open repo", repo.repoUrl));
    row.appendChild(actionCell);

    issueHealthBody.appendChild(row);
  }
}

function openButton(label: string, url: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("data-url", url);
  button.className = "link-button";
  return button;
}

function cellWithText(text: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function cellWithBadge(text: string, tone: "ok" | "warn" | "muted"): HTMLTableCellElement {
  const cell = document.createElement("td");
  const span = document.createElement("span");
  span.textContent = text;
  span.className = `badge badge-${tone}`;
  cell.appendChild(span);
  return cell;
}

function setStatus(message: string, tone: "info" | "success" | "error"): void {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner status-${tone}`;
}

function readSettingsFromForm(): AppSettings {
  return {
    token: tokenInput.value.trim(),
    staleDays: toInt(staleDaysInput.value, DEFAULT_SETTINGS.staleDays),
    visibilityFilter: toVisibilityFilter(visibilityFilterSelect.value),
    hasOpenIssuesOnly: hasOpenIssuesOnlyCheckbox.checked,
    hasStaleIssuesOnly: hasStaleIssuesOnlyCheckbox.checked,
    sortBy: toSortBy(sortBySelect.value),
    autoRefreshMinutes: toInt(autoRefreshMinutesInput.value, DEFAULT_SETTINGS.autoRefreshMinutes),
  };
}

function applySettingsToForm(settings: AppSettings): void {
  tokenInput.value = settings.token ?? "";
  staleDaysInput.value = String(settings.staleDays ?? DEFAULT_SETTINGS.staleDays);
  visibilityFilterSelect.value = settings.visibilityFilter ?? DEFAULT_SETTINGS.visibilityFilter;
  hasOpenIssuesOnlyCheckbox.checked = Boolean(settings.hasOpenIssuesOnly);
  hasStaleIssuesOnlyCheckbox.checked = Boolean(settings.hasStaleIssuesOnly);
  sortBySelect.value = settings.sortBy ?? DEFAULT_SETTINGS.sortBy;
  autoRefreshMinutesInput.value = String(
    settings.autoRefreshMinutes ?? DEFAULT_SETTINGS.autoRefreshMinutes,
  );
}

function configureAutoRefresh(minutes: number): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  if (minutes <= 0) {
    return;
  }

  const everyMs = minutes * 60 * 1000;
  state.timer = setInterval(() => {
    void refreshPortfolio();
  }, everyMs);
}

function applyFiltersAndSort(repos: RepoSummary[], settings: AppSettings): RepoSummary[] {
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
        return b.staleIssueCount - a.staleIssueCount || b.openIssueCount - a.openIssueCount;
      case "open_issues_desc":
        return b.openIssueCount - a.openIssueCount || b.staleIssueCount - a.staleIssueCount;
      case "last_pushed_asc":
        return new Date(a.pushedAt).getTime() - new Date(b.pushedAt).getTime();
      case "last_pushed_desc":
      default:
        return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
    }
  });

  return filtered;
}

function toInt(raw: string, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
}

function toVisibilityFilter(raw: string): VisibilityFilter {
  if (raw === "public" || raw === "private" || raw === "all") {
    return raw;
  }
  return "all";
}

function toSortBy(raw: string): SortBy {
  if (
    raw === "stale_desc" ||
    raw === "open_issues_desc" ||
    raw === "last_pushed_desc" ||
    raw === "last_pushed_asc"
  ) {
    return raw;
  }
  return "stale_desc";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatDate(dateText: string): string {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString();
}

function formatTimestamp(dateText: string): string {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }
  return date.toLocaleString();
}
