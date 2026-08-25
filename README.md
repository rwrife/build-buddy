# build-buddy 🐤

**A tiny always-on-top desktop critter whose mood mirrors your project's live build/CI health.**

Green pipeline? It's bouncing and happy. Tests failing? It's sick and sulking. PR merged?
Confetti. `build-buddy` is an **ambient, glanceable status monitor disguised as a pet** —
so you can stop keeping a CI tab open just to see if the build went red.

> ⚠️ Early days. This is a fresh auto-tool-lab experiment — see [`PLAN.md`](PLAN.md) for
> the full roadmap and current milestones.

## Issue #11 MVP increment: GitHub Repo Manager (Electron + TypeScript)

This branch adds an Electron desktop utility that helps answer:

- which repos are **public** vs **private**,
- which repos have **open issues**,
- which repos have **stale issues** based on a configurable threshold.

### What this MVP includes

- Electron app shell with TypeScript (`src/main.ts`, `src/preload.ts`, `src/renderer.ts`)
- GitHub REST integration with pagination (`src/github.ts`)
- Repo inventory table:
  - repo name
  - visibility
  - archived flag
  - default branch
  - open issues count
  - open PR count
  - latest workflow health (passing/failing/pending/unknown)
  - one-click link to latest failing GitHub Actions run (when available)
  - last push date
- Issue health table with stale issue examples and click-through links
- Filters (visibility, has-open-issues, has-stale-issues)
- Sorting (stale count, open issue count, last push asc/desc)
- Settings persistence (token, stale threshold, filters, refresh interval)
- Manual refresh + optional auto-refresh interval
- Watched-repo mood line (happy/sad/working/unknown) derived from latest Actions run
- Animated buddy mood avatar that reflects watched-repo health (`happy`, `sad`, `working`, `unknown`)
- Graceful workflow-state fallback for no-runs / unavailable / rate-limited repos

### Configure the GitHub source mood (Issue #6 increment)

1. Enter a GitHub PAT and click **Refresh**.
2. Set **Watched repo (owner/name)**, e.g. `rwrife/build-buddy`.
3. The app maps latest Actions state to mood:
   - `success` → `happy`
   - failing conclusions (`failure`, `timed_out`, `cancelled`, …) → `sad`
   - non-completed runs (`queued`, `in_progress`, …) → `working`
   - no runs / unavailable data → `unknown`

The watched-repo mood line updates on each refresh (manual or auto-refresh).

### Choose a pet skin

Set `[pet].skin` in `build-buddy.toml` (or the machine-local override) to one of the
three bundled animated critters:

```toml
[pet]
skin = "cat" # "duck", "cat", or "ghost"
```

Each skin has distinct happy, sad, and working animation frames. An unknown skin logs a
warning and safely falls back to `duck`.

### Run locally

```bash
npm install
npm run start
```

### Configure multiple project buddies

Define one or more `[[sources]]` entries in `build-buddy.toml`. Each source opens its own
small, draggable, always-on-top pet window with an independent mood and lifecycle:

```toml
[[sources]]
id = "web-tests"
name = "Web tests"
kind = "local"
command = "npm test"
cwd = "packages/web"
interval = 60
timeout = 300
skin = "duck"
x = 40
y = 40

[[sources]]
id = "api-ci"
name = "API CI"
kind = "github"
repo = "owner/api"
interval = 60
skin = "cat"
# x/y are optional; omitted buddies use a non-overlapping grid.
```

`build-buddy.local.toml` is loaded afterward as a gitignored machine-local override. If it
defines `[[sources]]`, its complete source list replaces the base list. Relative `cwd` values
resolve from the config directory. GitHub buddies use the PAT saved in the dashboard.
Right-click an individual buddy to run, pause/resume, or quit only that source; the other
buddies continue polling.

A legacy single `[local]` table is still supported when no `[[sources]]` list exists. Its
command starts immediately, runs asynchronously, and repeats after the configured interval.
Set `BUILD_BUDDY_CONFIG_DIR` to load both config files from another directory.

### Test

```bash
npm test
```

### Build an installable desktop package

```bash
npm install
npm run dist
```

The package for your current operating system is written to `release/`. GitHub Actions
builds the native targets on each platform: AppImage on Linux, DMG on macOS, and NSIS
installer on Windows. Every workflow run uploads those packages as downloadable artifacts.

Packaged windows use transparent rounded edges. Drag the header to reposition the window;
right-click anywhere for Run now, Pause/Resume, and Quit.

Settings are persisted to Electron's local `userData` path on your machine.

## Why

Most desktop pets are decorative. Most CI monitors are dense, list-y menubar apps.
`build-buddy` splits the difference: the *fun* of a desktop critter, wired to the *real*
job of telling you your build state — in a signal you can read in 200ms from across the
room.

## How it works (v0.1 plan)

- Point it at a command — `npm test`, `pytest`, `cargo build`, etc.
- It runs that command on an interval and maps the **exit code → mood**:
  - `0` → 😄 happy
  - non-zero → 😢 sad
  - running → 🤔 working
- The critter lives in a small, frameless, always-on-top, draggable window.
- Config lives in a simple `build-buddy.toml`. No accounts. No cloud. No telemetry.

Later: sound effects, streak tracking, and more (see [`PLAN.md`](PLAN.md) §8).

## Status

🚧 Bootstrapping. Follow the milestone issues (`[M1]`…`[M6]`) to watch it come together.

## Tech

Electron · TypeScript · HTML/CSS · local TOML config · Node child processes. Cross-platform,
local-first, and no telemetry.

## License

MIT (see [`LICENSE`](LICENSE)).
