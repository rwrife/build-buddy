import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLocalCommandConfig } from "../src/local-config";
import {
  formatLocalCommandLog,
  LocalCommandPoller,
  runLocalCommand,
} from "../src/local-poller";

async function withTempDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "build-buddy-config-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("loadLocalCommandConfig merges local overrides and applies defaults", async () => {
  await withTempDir(async (directory) => {
    await fs.mkdir(path.join(directory, "packages", "app"), { recursive: true });
    await fs.writeFile(
      path.join(directory, "build-buddy.toml"),
      '[local]\ncommand = "npm test"\ninterval = 30\n',
    );
    await fs.writeFile(
      path.join(directory, "build-buddy.local.toml"),
      '[local]\ninterval = 5\ntimeout = 9\ncwd = "packages/app"\n',
    );

    const config = await loadLocalCommandConfig(directory);

    assert.deepEqual(config, {
      command: "npm test",
      cwd: path.join(directory, "packages", "app"),
      intervalSeconds: 5,
      timeoutSeconds: 9,
    });
  });
});

test("loadLocalCommandConfig rejects timer values above Node's supported range", async () => {
  await withTempDir(async (directory) => {
    await fs.writeFile(
      path.join(directory, "build-buddy.toml"),
      '[local]\ncommand = "npm test"\ninterval = 2147484\n',
    );

    await assert.rejects(
      loadLocalCommandConfig(directory),
      /\[local\]\.interval must be between 1 and 2147483/,
    );
  });
});

test("runLocalCommand captures exit code, output, and duration", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "command.js");
    await fs.writeFile(
      scriptPath,
      'process.stdout.write("ready"); process.stderr.write("note"); process.exitCode = 3;\n',
    );

    const result = await runLocalCommand({
      command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
      cwd: directory,
      intervalSeconds: 60,
      timeoutSeconds: 5,
    });

    assert.equal(result.exitCode, 3);
    assert.equal(result.timedOut, false);
    assert.equal(result.stdout, "ready");
    assert.equal(result.stderr, "note");
    assert.ok(result.durationMs >= 0);
  });
});

test("runLocalCommand terminates commands that exceed the timeout", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "slow.js");
    await fs.writeFile(scriptPath, "setTimeout(() => {}, 1_000);\n");

    const result = await runLocalCommand({
      command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
      cwd: directory,
      intervalSeconds: 60,
      timeoutSeconds: 0.05,
    });

    assert.equal(result.timedOut, true);
    assert.equal(result.exitCode, null);
    assert.ok(result.durationMs < 1_000);
  });
});

test("LocalCommandPoller stops an in-flight command", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "long-running.js");
    await fs.writeFile(scriptPath, "setTimeout(() => {}, 5_000);\n");

    let receiveResult: ((cancelled: boolean) => void) | undefined;
    const resultReceived = new Promise<boolean>((resolve) => {
      receiveResult = resolve;
    });
    const poller = new LocalCommandPoller(
      {
        command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
        cwd: directory,
        intervalSeconds: 60,
        timeoutSeconds: 10,
      },
      (result) => {
        receiveResult?.(result.cancelled);
      },
    );

    poller.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    poller.stop();

    assert.equal(await withTimeout(resultReceived, 1_000), true);
  });
});

test("LocalCommandPoller starts a fresh command immediately after stop and restart", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "medium-running.js");
    await fs.writeFile(scriptPath, "setTimeout(() => {}, 500);\n");

    let resultCount = 0;
    const secondResult = new Promise<void>((resolve) => {
      const poller = new LocalCommandPoller(
        {
          command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
          cwd: directory,
          intervalSeconds: 1,
          timeoutSeconds: 5,
        },
        () => {
          resultCount += 1;
          if (resultCount === 2) {
            poller.stop();
            resolve();
          }
        },
      );

      poller.start();
      setTimeout(() => {
        poller.stop();
        poller.start();
      }, 50);
    });

    await withTimeout(secondResult, 900);
    assert.equal(resultCount, 2);
  });
});

test("LocalCommandPoller runs immediately and repeats until stopped", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "success.js");
    await fs.writeFile(scriptPath, 'process.stdout.write("ok");\n');

    const results: number[] = [];
    const poller = new LocalCommandPoller(
      {
        command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
        cwd: directory,
        intervalSeconds: 1,
        timeoutSeconds: 5,
      },
      (result) => {
        results.push(result.exitCode ?? -1);
      },
    );

    poller.start();
    await waitFor(() => results.length >= 2, 2_000);
    poller.stop();

    assert.deepEqual(results.slice(0, 2), [0, 0]);
  });
});

test("LocalCommandPoller continues after a result callback fails", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "success.js");
    await fs.writeFile(scriptPath, "process.exit(0);\n");

    let resultCount = 0;
    let errorCount = 0;
    const poller = new LocalCommandPoller(
      {
        command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
        cwd: directory,
        intervalSeconds: 1,
        timeoutSeconds: 5,
      },
      () => {
        resultCount += 1;
        if (resultCount === 1) {
          throw new Error("callback failed");
        }
      },
      () => {
        errorCount += 1;
      },
    );

    poller.start();
    await waitFor(() => resultCount >= 2, 2_000);
    poller.stop();

    assert.equal(errorCount, 1);
  });
});

test("LocalCommandPoller contains errors thrown by the error handler", async () => {
  await withTempDir(async (directory) => {
    const scriptPath = path.join(directory, "success.js");
    await fs.writeFile(scriptPath, "process.exit(0);\n");

    const poller = new LocalCommandPoller(
      {
        command: `${JSON.stringify(process.execPath)} ${JSON.stringify(scriptPath)}`,
        cwd: directory,
        intervalSeconds: 60,
        timeoutSeconds: 5,
      },
      () => {
        throw new Error("callback failed");
      },
      () => {
        throw new Error("error handler failed");
      },
    );

    const result = await poller.runNow();
    assert.equal(result.exitCode, 0);
  });
});

test("formatLocalCommandLog records outcome, exit code, and duration", () => {
  assert.equal(
    formatLocalCommandLog({
      command: "npm test",
      exitCode: 3,
      durationMs: 42,
      timedOut: false,
      cancelled: false,
      stdout: "",
      stderr: "",
    }),
    "[local-poller] FAIL exit=3 duration=42ms",
  );
});

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Timed out waiting for result")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
