import test from "node:test";
import assert from "node:assert/strict";

import { GitHubClient } from "../src/github";

test("getWorkflowSnapshot reads one configured repository without loading the portfolio", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        workflow_runs: [
          {
            id: 42,
            name: "CI",
            html_url: "https://github.com/example/api/actions/runs/42",
            status: "completed",
            conclusion: "success",
            updated_at: "2026-08-25T00:00:00Z",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const snapshot = await new GitHubClient("test-token").getWorkflowSnapshot("example/api");

    assert.equal(snapshot.health, "passing");
    assert.equal(snapshot.latestWorkflowName, "CI");
    assert.deepEqual(requestedUrls, [
      "https://api.github.com/repos/example/api/actions/runs?per_page=10&page=1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
