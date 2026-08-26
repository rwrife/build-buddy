import test from "node:test";
import assert from "node:assert/strict";

import { createBuddyWindowOptions } from "../src/window-options";

test("buddy window is a fixed frameless always-on-top desktop critter", () => {
  const options = createBuddyWindowOptions(
    { name: "API checks", x: 120, y: 80 },
    "/app/dist/src/buddy-preload.js",
  );

  assert.equal(options.width, 168);
  assert.equal(options.height, 156);
  assert.equal(options.x, 120);
  assert.equal(options.y, 80);
  assert.equal(options.frame, false);
  assert.equal(options.transparent, true);
  assert.equal(options.alwaysOnTop, true);
  assert.equal(options.resizable, false);
  assert.equal(options.title, "build-buddy · API checks");
  assert.deepEqual(options.webPreferences, {
    preload: "/app/dist/src/buddy-preload.js",
    contextIsolation: true,
    nodeIntegration: false,
  });
});
