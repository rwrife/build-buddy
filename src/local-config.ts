import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

export interface LocalCommandConfig {
  command: string;
  cwd: string;
  intervalSeconds: number;
  timeoutSeconds: number;
}

const DEFAULT_INTERVAL_SECONDS = 60;
const DEFAULT_TIMEOUT_SECONDS = 600;
const MAX_TIMER_SECONDS = 2_147_483;

export async function loadLocalCommandConfig(baseDirectory: string): Promise<LocalCommandConfig | null> {
  const base = await readConfigFile(path.join(baseDirectory, "build-buddy.toml"));
  const override = await readConfigFile(path.join(baseDirectory, "build-buddy.local.toml"));
  const local = {
    ...asTable(base.local),
    ...asTable(override.local),
  };

  if (local.command === undefined) {
    return null;
  }
  if (typeof local.command !== "string" || !local.command.trim()) {
    throw new Error("[local].command must be a non-empty string");
  }

  const configuredCwd = local.cwd === undefined ? "." : local.cwd;
  if (typeof configuredCwd !== "string" || !configuredCwd.trim()) {
    throw new Error("[local].cwd must be a non-empty string");
  }

  return {
    command: local.command.trim(),
    cwd: path.resolve(baseDirectory, configuredCwd),
    intervalSeconds: positiveInteger(
      local.interval,
      DEFAULT_INTERVAL_SECONDS,
      "[local].interval",
    ),
    timeoutSeconds: positiveInteger(
      local.timeout,
      DEFAULT_TIMEOUT_SECONDS,
      "[local].timeout",
    ),
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

function asTable(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
