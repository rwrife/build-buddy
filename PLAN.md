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
- Runs on Windows/macOS/Linux from one Python codebase.

That's it. No accounts, no cloud, no telemetry.

## 5. Tech stack

Boring, fast, cross-platform:

- **Python 3.11+** — ubiquitous, quick to iterate, great subprocess handling.
- **[pywebview](https://pywebview.flowlib.com/)** for the window — gives a frameless,
  always-on-top, transparent-capable window backed by the OS webview, so the critter can
  be drawn/animated in plain **HTML/CSS/JS** (easy sprite animation, easy theming) without
  shipping a heavy GUI toolkit. Fallback consideration: Tkinter if pywebview proves fiddly
  on a target OS (documented as a risk).
- **[tomllib](https://docs.python.org/3/library/tomllib.html)** (stdlib) for config —
  zero dependencies for reading TOML.
- **subprocess** (stdlib) for running the user's build/test command.
- Packaging later via **PyInstaller** for one-file binaries per OS.

Rationale: HTML/CSS for the pet = trivial animation + skinnable; Python core = fast to
build and easy for contributors; stdlib-first = light footprint, true to the "small,
local-first utility" promise.

## 6. Architecture

```
build-buddy/
├── buildbuddy/
│   ├── __main__.py        # entrypoint: load config, start poller + window
│   ├── config.py          # load/validate build-buddy.toml, defaults, discovery
│   ├── poller.py          # runs the command on an interval, emits Mood events
│   ├── mood.py            # Mood enum + exit-code/status → Mood mapping
│   ├── window.py          # pywebview window setup (frameless, on-top, tray/menu)
│   └── web/               # the critter UI (HTML/CSS/JS + sprite assets)
│       ├── index.html
│       ├── buddy.css
│       └── buddy.js       # listens for mood changes, swaps animation
├── assets/                # sprite frames per mood
├── build-buddy.toml       # sample config
├── PLAN.md
└── README.md
```

Key modules:

- **poller** — the heart. Owns a timer, runs the configured command in a subprocess with
  a timeout, captures exit code, and pushes a `Mood` to the window via the pywebview JS
  bridge. Never blocks the UI thread.
- **mood** — pure mapping logic (exit code / CI conclusion → `Mood`). Unit-testable with
  no GUI.
- **window** — thin wrapper over pywebview; exposes a `set_mood(mood)` JS call and the
  right-click menu actions.
- **web/** — dumb view: given a mood string, play the matching animation. Fully swappable
  for reskins/themes.

## 7. Milestones (each shippable)

1. **M1 — Scaffold + hello-world.** Python package skeleton, `pip install -e .`,
   `python -m buildbuddy` opens a frameless always-on-top window that renders a static
   critter and can be dragged. CI (lint) green.
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
