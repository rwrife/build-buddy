# build-buddy 🐤

**A tiny always-on-top desktop critter whose mood mirrors your project's live build/CI health.**

Green pipeline? It's bouncing and happy. Tests failing? It's sick and sulking. PR merged?
Confetti. `build-buddy` is an **ambient, glanceable status monitor disguised as a pet** —
so you can stop keeping a CI tab open just to see if the build went red.

> ⚠️ Early days. This is a fresh auto-tool-lab experiment — see [`PLAN.md`](PLAN.md) for
> the full roadmap and current milestones.

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

Later: a GitHub Actions data source, skins, multi-project buddies, and more (see
[`PLAN.md`](PLAN.md) §8).

## Status

🚧 Bootstrapping. Follow the milestone issues (`[M1]`…`[M6]`) to watch it come together.

## Tech

Python 3.11+ · [pywebview](https://pywebview.flowlib.com/) for the window · HTML/CSS/JS
for the critter · stdlib for config & subprocess. Boring, fast, cross-platform,
local-first.

## License

MIT (see [`LICENSE`](LICENSE)).
