import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import { DEFAULT_PET_SKIN, isPetSkin, PetSkin } from "./pet-skins";

export interface PetConfig {
  skin: PetSkin;
  warning: string | null;
}

export async function loadPetConfig(baseDirectory: string): Promise<PetConfig> {
  const base = await readConfigFile(path.join(baseDirectory, "build-buddy.toml"));
  const override = await readConfigFile(path.join(baseDirectory, "build-buddy.local.toml"));
  const pet = {
    ...asTable(base.pet),
    ...asTable(override.pet),
  };

  const configuredSkin = pet.skin ?? DEFAULT_PET_SKIN;
  if (isPetSkin(configuredSkin)) {
    return { skin: configuredSkin, warning: null };
  }

  return {
    skin: DEFAULT_PET_SKIN,
    warning: `[pet].skin ${JSON.stringify(configuredSkin)} is unknown; falling back to ${JSON.stringify(DEFAULT_PET_SKIN)}`,
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
