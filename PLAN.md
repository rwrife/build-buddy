# build-buddy 🐤

> A tiny always-on-top desktop critter whose mood mirrors your project's **live** build/CI health.

## 1. Pitch

`build-buddy` is a small, cross-platform desktop companion that sits in the corner of
your screen and reacts to the health of whatever you're currently working on. Pipeline
green? It's bouncing and happy. Tests failing? It's sick and sulking. PR just merged? It
throws confetti. It's an **ambient, glanceable status monitor disguised as a pet** — so
you can stop keeping a GitHub Actions tab open just to see if the build went red.

## 2. Trend inspiration

Two live signals converged the day this was scoped (2026-07-06):

- **Desktop pets/companions are trending again.** "Show HN: Pet Reminder – A macOS
  reminder app with a desktop pet" was sitting near the top of
  [Hacker News /show](https://news.ycombinator.com/show) with fresh upvotes. Desktop
  critters are having a moment, but almost all of them are *decorative* or *reminder*
  toys — they don't *do* anything tied to your actual work.
- **Windows/desktop users want small, local-first utilities that kill specific friction.**
  Per [WindowsForum's "Top Windows 11 Utilities of 2026"](https://windowsforum.com/threads/top-windows-11-utilities-of-2026-launchers-privacy-tools-and-workflow-boosters.414265/),
  the 2026 crop that people actually love is "focused utilities that solve very specific
  annoyances… local-first privacy promises." One named friction point: notification
  placement/awareness. "Did my build break?" is exactly that kind of nagging,
  tab-checking friction.

So: take the *fun* of the trending desktop-pet format and staple it to a *real* job —
telling you your build state without stealing your focus.

## 3. Why it's different

- **vs. decorative desktop pets (Pet Reminder, Bongo Cat, Shimeji):** those are cosmetic
  or reminder-based. build-buddy's entire mood is *driven by real signals* — CI status
  and local test exit codes. The pet is the UI for a monitor, not the point itself.
- **vs. `commit-sprout` (our own repo):** commit-sprout grows an ASCII plant from your
  *commit history* — it's a retrospective journal of the past. build-buddy reflects the
  *present* live build/CI state. Past vs. now; journal vs. monitor.
- **vs. CI status bars / menubar apps (e.g. CCMenu, GitHub Actions extensions):** those
  are dense, list-y, and utilitarian. build-buddy is a single glanceable emotional signal
  you read in 200ms from across the room, with zero list-scanning.
- **vs. `noise-snitch` (our own repo):** noise-snitch watches *audio events*;
  build-buddy watches *build health*. Different signal, different job.

## 4. MVP scope (v0.1)

The smallest genuinely useful thing:

- A small **always-on-top, frameless, draggable window** showing one animated critter.
- **One data source to start: a local command.** Point build-buddy at a shell command
  (e.g. `npm test`, `pytest`, `cargo build`) via config; it runs it on an interval and
  maps the **exit code → mood** (0 = happy, non-zero = sad, running = "thinking").
- **3 core moods** with simple frame-based sprite animation: `happy`, `sad`, `working`.
- A tiny **config file** (`build-buddy.toml`) for: the command, the poll interval, and
  window position.
- **Right-click menu**: Run now, Pause, Quit.
- Runs on Windows/macOS/Linux from one Electron + TypeScript codebase.

That's it. No accounts, no cloud, no telemetry.

## 5. Tech stack

- **Electron + TypeScript** for cross-platform frameless, always-on-top windows and a
  strongly typed main/preload/renderer boundary.
- **HTML/CSS** for draggable, animated, skinnable critters.
- **smol-toml** for local configuration and **Node child processes** for local commands.
- **electron-builder** for AppImage, DMG, and NSIS packages in CI.

The project adopted Electron after the original Python/pywebview proposal. The product
goals remain unchanged: local-first operation, no telemetry, and one desktop codebase.

## 6. Architecture

```
build-buddy/
├── src/
│   ├── main.ts                  # Electron lifecycle and dashboard window
│   ├── buddy-window-manager.ts  # independent critter windows and source runtimes
│   ├── local-poller.ts          # bounded local-command polling
│   ├── github.ts                # GitHub Actions/repository data source
│   ├── buddy.html / buddy.css   # draggable critter UI
│   └── renderer.ts              # dashboard UI
├── tests/                       # Node test runner coverage
├── assets/                      # application icons
├── build-buddy.toml             # sample config
├── PLAN.md
└── README.md
```

Key modules:

- **local poller / GitHub source** — run independently and publish typed mood updates.
- **buddy window manager** — creates fixed frameless, always-on-top windows and owns each
  source runtime's lifecycle.
- **preload + renderer** — expose a narrow IPC bridge and render mood/skin changes without
  Node integration in web content.

## 7. Milestones (each shippable)

1. **M1 — Scaffold + hello-world (complete).** Installable Electron package; `npm run
   start` opens frameless always-on-top draggable critter windows; TypeScript lint,
   tests, builds, and desktop packaging run in CI.
2. **M2 — Config + local-command poller.** Load `build-buddy.toml`, run the configured
   command on an interval in a subprocess, log exit codes. No UI reaction yet.
3. **M3 — Moods wired to the pet.** Exit-code → `Mood` mapping; poller pushes mood to the
   web UI over the JS bridge; critter swaps between happy/sad/working animations.
4. **M4 — Right-click menu + lifecycle.** Run-now, Pause/Resume, Quit; persist window
   position; graceful shutdown of the subprocess.
5. **M5 — Polish + packaging.** Nicer sprites, transparent window edges, sensible
   defaults + first-run config discovery; PyInstaller one-file builds for Win/mac/Linux
   in CI artifacts.
6. **M6 — GitHub Actions data source.** Optional: instead of a local command, poll a
   repo's latest Actions run conclusion via `gh`/REST and map success/failure/in_progress
   → mood. Config toggle between `local` and `github` source.

## 8. Backlog / future features (v0.2+)

1. **Skins/themes** — ship multiple critters (duck, cat, ghost, blob); pick in config.
2. **Multi-project buddies** — one pet per watched repo, each with its own mood.
3. **Sound effects** — optional little chirp on red→green recovery (mutable).
4. **Streak tracking** — pet gets progressively happier the longer the build stays green.
5. **Coverage/perf moods** — extra reactions when test coverage or a benchmark drops.
6. **Notification bubble** — speech-bubble that names *what* broke (failing test/job).
7. **Idle/night mode** — pet sleeps during configured quiet hours to save cycles.
8. **Click-to-open** — clicking the pet opens the failing run/log in the browser.
9. **More data sources** — GitLab CI, local Docker healthcheck, a webhook endpoint.
10. **Pomodoro overlay** — pet naps/works with a focus timer.
11. **"Feed the pet"** — silly gamification: green builds earn treats, a tiny stats page.
12. **Portable/tray-only mode** — collapse into the system tray with mood as the icon.

## 9. Out of scope (deliberately NOT building)

- A full CI dashboard / log viewer — build-buddy shows *one* emotional signal, not tables.
- Accounts, cloud sync, or any telemetry — strictly local-first.
- Managing/triggering pipelines or deployments — it's a read-only mood mirror.
- A mobile app.
- A general-purpose desktop-pet framework — the pet is the UI, build health is the point.
- Heavy GPU/3D graphics — 2D sprite frames only, low CPU footprint.
