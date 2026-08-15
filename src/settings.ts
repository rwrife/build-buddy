import { promises as fs } from "node:fs";
import path from "node:path";
import { AppSettings } from "./shared/types";

export const DEFAULT_SETTINGS: AppSettings = {
  token: "",
  watchedRepo: "",
  staleDays: 30,
  visibilityFilter: "all",
  hasOpenIssuesOnly: false,
  hasStaleIssuesOnly: false,
  sortBy: "stale_desc",
  autoRefreshMinutes: 0,
  uiPaused: false,
  windowBounds: null,
};

export async function loadSettings(filePath: string): Promise<AppSettings> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return normalizeSettings(JSON.parse(content));
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  filePath: string,
  partial: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await loadSettings(filePath);
  const merged = normalizeSettings({ ...current, ...partial });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

function normalizeSettings(input: unknown): AppSettings {
  const value = (input ?? {}) as Record<string, unknown>;

  const visibilityFilter =
    value.visibilityFilter === "public" ||
    value.visibilityFilter === "private" ||
    value.visibilityFilter === "all"
      ? value.visibilityFilter
      : DEFAULT_SETTINGS.visibilityFilter;

  const sortByValues = [
    "stale_desc",
    "open_issues_desc",
    "last_pushed_desc",
    "last_pushed_asc",
  ] as const;

  const sortBy = sortByValues.includes(value.sortBy as (typeof sortByValues)[number])
    ? (value.sortBy as AppSettings["sortBy"])
    : DEFAULT_SETTINGS.sortBy;

  return {
    token: String(value.token ?? DEFAULT_SETTINGS.token),
    watchedRepo: String(value.watchedRepo ?? DEFAULT_SETTINGS.watchedRepo).trim(),
    staleDays: clampInt(value.staleDays, 1, 3650, DEFAULT_SETTINGS.staleDays),
    visibilityFilter,
    hasOpenIssuesOnly: Boolean(value.hasOpenIssuesOnly),
    hasStaleIssuesOnly: Boolean(value.hasStaleIssuesOnly),
    sortBy,
    autoRefreshMinutes: clampInt(
      value.autoRefreshMinutes,
      0,
      1440,
      DEFAULT_SETTINGS.autoRefreshMinutes,
    ),
    uiPaused: Boolean(value.uiPaused),
    windowBounds: normalizeWindowBounds(value.windowBounds),
  };
}

function normalizeWindowBounds(value: unknown): AppSettings["windowBounds"] {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeBounds = value as Record<string, unknown>;
  const x = Number(maybeBounds.x);
  const y = Number(maybeBounds.y);
  const width = Number(maybeBounds.width);
  const height = Number(maybeBounds.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(980, Math.round(width)),
    height: Math.max(720, Math.round(height)),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}
