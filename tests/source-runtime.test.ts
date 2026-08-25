import test from "node:test";
import assert from "node:assert/strict";

import { BuddySourceDriver, BuddySourceRuntime } from "../src/source-runtime";

class FakeDriver implements BuddySourceDriver {
  starts = 0;
  stops = 0;
  runs = 0;

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  async runNow(): Promise<void> {
    this.runs += 1;
  }
}

test("pausing or disposing one source leaves other buddy sources running", async () => {
  const firstDriver = new FakeDriver();
  const secondDriver = new FakeDriver();
  const first = new BuddySourceRuntime(firstDriver);
  const second = new BuddySourceRuntime(secondDriver);

  first.start();
  second.start();
  first.pause();
  await second.runNow();
  first.dispose();

  assert.deepEqual(
    {
      first: { starts: firstDriver.starts, stops: firstDriver.stops, runs: firstDriver.runs },
      second: { starts: secondDriver.starts, stops: secondDriver.stops, runs: secondDriver.runs },
    },
    {
      first: { starts: 1, stops: 1, runs: 0 },
      second: { starts: 1, stops: 0, runs: 1 },
    },
  );
});

test("resuming a paused source restarts only that source", () => {
  const firstDriver = new FakeDriver();
  const secondDriver = new FakeDriver();
  const first = new BuddySourceRuntime(firstDriver);
  const second = new BuddySourceRuntime(secondDriver);

  first.start();
  second.start();
  first.pause();
  first.resume();

  assert.equal(firstDriver.starts, 2);
  assert.equal(firstDriver.stops, 1);
  assert.equal(secondDriver.starts, 1);
  assert.equal(secondDriver.stops, 0);
});
