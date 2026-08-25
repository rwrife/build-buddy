import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadBuddySourcesConfig } from "../src/source-config";

async function withTempDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "build-buddy-sources-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("loadBuddySourcesConfig loads independent local and GitHub sources", async () => {
  await withTempDir(async (directory) => {
    await fs.mkdir(path.join(directory, "packages", "web"), { recursive: true });
    await fs.writeFile(
      path.join(directory, "build-buddy.toml"),
      [
        "[[sources]]",
        'id = "web-tests"',
        'name = "Web tests"',
        'kind = "local"',
        'command = "npm test"',
        'cwd = "packages/web"',
        "interval = 15",
        "timeout = 90",
        'skin = "cat"',
        "x = 25",
        "y = 35",
        "",
        "[[sources]]",
        'id = "api-ci"',
        'name = "API CI"',
        'kind = "github"',
        'repo = "example/api"',
        "interval = 120",
        'skin = "ghost"',
        "",
      ].join("\n"),
    );

    const sources = await loadBuddySourcesConfig(directory);

    assert.deepEqual(sources, [
      {
        id: "web-tests",
        name: "Web tests",
        kind: "local",
        command: "npm test",
        cwd: path.join(directory, "packages", "web"),
        intervalSeconds: 15,
        timeoutSeconds: 90,
        skin: "cat",
        x: 25,
        y: 35,
      },
      {
        id: "api-ci",
        name: "API CI",
        kind: "github",
        repo: "example/api",
        intervalSeconds: 120,
        skin: "ghost",
        x: 220,
        y: 40,
      },
    ]);
  });
});
