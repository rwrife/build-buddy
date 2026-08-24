import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadPetConfig } from "../src/pet-config";
import { DEFAULT_PET_SKIN, PET_MOODS, PET_SKINS, PET_SKIN_FRAMES } from "../src/pet-skins";

async function withTempDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "build-buddy-pet-config-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("loadPetConfig defaults to the duck skin", async () => {
  await withTempDir(async (directory) => {
    assert.deepEqual(await loadPetConfig(directory), {
      skin: DEFAULT_PET_SKIN,
      warning: null,
    });
  });
});

test("loadPetConfig applies a machine-local skin override", async () => {
  await withTempDir(async (directory) => {
    await fs.writeFile(path.join(directory, "build-buddy.toml"), '[pet]\nskin = "cat"\n');
    await fs.writeFile(
      path.join(directory, "build-buddy.local.toml"),
      '[pet]\nskin = "ghost"\n',
    );

    assert.deepEqual(await loadPetConfig(directory), {
      skin: "ghost",
      warning: null,
    });
  });
});

test("loadPetConfig warns and falls back for an unknown skin", async () => {
  await withTempDir(async (directory) => {
    await fs.writeFile(path.join(directory, "build-buddy.toml"), '[pet]\nskin = "blob"\n');

    const config = await loadPetConfig(directory);
    assert.equal(config.skin, DEFAULT_PET_SKIN);
    assert.match(config.warning ?? "", /"blob" is unknown; falling back to "duck"/);
  });
});

test("every shipped skin has animated happy, sad, and working frames", () => {
  assert.deepEqual(PET_SKINS, ["duck", "cat", "ghost"]);

  for (const skin of PET_SKINS) {
    for (const mood of PET_MOODS) {
      assert.ok(PET_SKIN_FRAMES[skin][mood].length > 0, `${skin}/${mood} has a frame`);
    }
    for (const mood of ["happy", "sad", "working"] as const) {
      assert.ok(PET_SKIN_FRAMES[skin][mood].length >= 2, `${skin}/${mood} is animated`);
    }
  }
});
