import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import { DEFAULT_PET_SKIN, isPetSkin, PetSkin } from "./pet-skins";

const DEFAULT_INTERVAL_SECONDS = 60;
const DEFAULT_TIMEOUT_SECONDS = 600;
const MAX_TIMER_SECONDS = 2_147_483;
const DEFAULT_ORIGIN = 40;
const WINDOW_STEP = 180;
const WINDOWS_PER_ROW = 4;

interface BuddySourceBase {
  id: string;
  name: string;
  intervalSeconds: number;
  skin: PetSkin;
  x: number;
  y: number;
}

export interface LocalBuddySourceConfig extends BuddySourceBase {
  kind: "local";
  command: string;
  cwd: string;
  timeoutSeconds: number;
}

export interface GitHubBuddySourceConfig extends BuddySourceBase {
  kind: "github";
  repo: string;
}

export type BuddySourceConfig = LocalBuddySourceConfig | GitHubBuddySourceConfig;

export async function loadBuddySourcesConfig(baseDirectory: string): Promise<BuddySourceConfig[]> {
  const base = await readConfigFile(path.join(baseDirectory, "build-buddy.toml"));
  const override = await readConfigFile(path.join(baseDirectory, "build-buddy.local.toml"));
  const rawSources = override.sources === undefined ? base.sources : override.sources;

  if (rawSources === undefined) {
    return [];
  }
  if (!Array.isArray(rawSources)) {
    throw new Error("[[sources]] must be an array of source tables");
  }

  const ids = new Set<string>();
  return rawSources.map((raw, index) => {
    const source = asTable(raw, `sources[${index}]`);
    const id = nonEmptyString(source.id, `sources[${index}].id`);
    if (ids.has(id)) {
      throw new Error(`sources[${index}].id must be unique: ${JSON.stringify(id)}`);
    }
    ids.add(id);

    const name = optionalString(source.name, id, `sources[${index}].name`);
    const kind = source.kind;
    const intervalSeconds = positiveInteger(
      source.interval,
      DEFAULT_INTERVAL_SECONDS,
      `sources[${index}].interval`,
    );
    const skin = petSkin(source.skin, `sources[${index}].skin`);
    const { x, y } = sourcePosition(source, index);

    if (kind === "local") {
      const configuredCwd = optionalString(source.cwd, ".", `sources[${index}].cwd`);
      return {
        id,
        name,
        kind,
        command: nonEmptyString(source.command, `sources[${index}].command`),
        cwd: path.resolve(baseDirectory, configuredCwd),
        intervalSeconds,
        timeoutSeconds: positiveInteger(
          source.timeout,
          DEFAULT_TIMEOUT_SECONDS,
          `sources[${index}].timeout`,
        ),
        skin,
        x,
        y,
      };
    }

    if (kind === "github") {
      const repo = nonEmptyString(source.repo, `sources[${index}].repo`)
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\/+$/, "");
      if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
        throw new Error(`sources[${index}].repo must use owner/name format`);
      }
      return { id, name, kind, repo, intervalSeconds, skin, x, y };
    }

    throw new Error(`sources[${index}].kind must be "local" or "github"`);
  });
}

function sourcePosition(source: Record<string, unknown>, index: number): { x: number; y: number } {
  const defaultX = DEFAULT_ORIGIN + (index % WINDOWS_PER_ROW) * WINDOW_STEP;
  const defaultY = DEFAULT_ORIGIN + Math.floor(index / WINDOWS_PER_ROW) * WINDOW_STEP;
  return {
    x: finiteInteger(source.x, defaultX, `sources[${index}].x`),
    y: finiteInteger(source.y, defaultY, `sources[${index}].y`),
  };
}

async function readConfigFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    return parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw new Error(`Unable to load ${path.basename(filePath)}: ${errorMessage(error)}`);
  }
}

function asTable(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be a table`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string, name: string): string {
  return value === undefined ? fallback : nonEmptyString(value, name);
}

function positiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > MAX_TIMER_SECONDS) {
    throw new Error(`${name} must be between 1 and ${MAX_TIMER_SECONDS}`);
  }
  return number;
}

function finiteInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a finite number`);
  }
  return Math.round(number);
}

function petSkin(value: unknown, name: string): PetSkin {
  if (value === undefined) {
    return DEFAULT_PET_SKIN;
  }
  if (!isPetSkin(value)) {
    throw new Error(`${name} must be "duck", "cat", or "ghost"`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
