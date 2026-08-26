import path from "node:path";
import { BrowserWindow, Menu } from "electron";
import { GitHubClient } from "./github";
import { LocalCommandPoller } from "./local-poller";
import { PetMood } from "./pet-skins";
import { mapWorkflowHealthToMood } from "./shared/logic";
import { loadSettings } from "./settings";
import { BuddySourceConfig, GitHubBuddySourceConfig, LocalBuddySourceConfig } from "./source-config";
import { BuddySourceDriver, BuddySourceRuntime } from "./source-runtime";
import { createBuddyWindowOptions } from "./window-options";

interface BuddyWindowRecord {
  window: BrowserWindow;
  runtime: BuddySourceRuntime;
}

export interface BuddyWindowInit {
  id: string;
  name: string;
  kind: BuddySourceConfig["kind"];
  detail: string;
  skin: BuddySourceConfig["skin"];
}

export interface BuddyMoodUpdate {
  mood: PetMood;
  detail: string;
}

export class BuddyWindowManager {
  private readonly records = new Map<number, BuddyWindowRecord>();

  constructor(
    private readonly settingsPath: string,
    private readonly appPath: string,
  ) {}

  launch(sources: BuddySourceConfig[]): void {
    for (const source of sources) {
      this.createBuddyWindow(source);
    }
  }

  stopAll(): void {
    for (const { runtime } of this.records.values()) {
      runtime.dispose();
    }
    this.records.clear();
  }

  private createBuddyWindow(source: BuddySourceConfig): void {
    const preloadPath = path.join(__dirname, "buddy-preload.js");
    const window = new BrowserWindow(createBuddyWindowOptions(source, preloadPath));

    const publish = (update: BuddyMoodUpdate): void => {
      if (!window.isDestroyed()) {
        window.webContents.send("buddy:mood", update);
      }
    };
    const driver = this.createDriver(source, publish);
    const runtime = new BuddySourceRuntime(driver);
    this.records.set(window.id, { window, runtime });

    window.webContents.once("did-finish-load", () => {
      const init: BuddyWindowInit = {
        id: source.id,
        name: source.name,
        kind: source.kind,
        detail: source.kind === "local" ? source.cwd : source.repo,
        skin: source.skin,
      };
      window.webContents.send("buddy:init", init);
      runtime.start();
    });

    window.webContents.on("context-menu", () => {
      const menu = Menu.buildFromTemplate([
        {
          label: "Run now",
          click: () => {
            void runtime.runNow();
          },
        },
        {
          label: runtime.isPaused ? "Resume buddy" : "Pause buddy",
          click: () => {
            if (runtime.isPaused) {
              runtime.resume();
            } else {
              runtime.pause();
              publish({ mood: "unknown", detail: "Paused" });
            }
          },
        },
        { type: "separator" },
        {
          label: "Quit buddy",
          click: () => window.close(),
        },
      ]);
      menu.popup({ window });
    });

    window.on("closed", () => {
      runtime.dispose();
      this.records.delete(window.id);
    });

    void window.loadFile(path.join(this.appPath, "src", "buddy.html"));
  }

  private createDriver(
    source: BuddySourceConfig,
    publish: (update: BuddyMoodUpdate) => void,
  ): BuddySourceDriver {
    return source.kind === "local"
      ? createLocalDriver(source, publish)
      : new GitHubBuddyDriver(source, this.settingsPath, publish);
  }
}

function createLocalDriver(
  source: LocalBuddySourceConfig,
  publish: (update: BuddyMoodUpdate) => void,
): BuddySourceDriver {
  const poller = new LocalCommandPoller(
    source,
    (result) => {
      if (result.cancelled) {
        return;
      }
      publish({
        mood: result.exitCode === 0 && !result.timedOut ? "happy" : "sad",
        detail: result.timedOut
          ? `${source.name}: command timed out`
          : `${source.name}: exit ${result.exitCode ?? "unknown"}`,
      });
    },
    (error) => {
      publish({ mood: "unknown", detail: `${source.name}: ${errorMessage(error)}` });
    },
  );

  return {
    start: () => {
      publish({ mood: "working", detail: `${source.name}: running command` });
      poller.start();
    },
    stop: () => poller.stop(),
    runNow: async () => {
      publish({ mood: "working", detail: `${source.name}: running command` });
      await poller.runNow();
    },
  };
}

class GitHubBuddyDriver implements BuddySourceDriver {
  private active = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly source: GitHubBuddySourceConfig,
    private readonly settingsPath: string,
    private readonly publish: (update: BuddyMoodUpdate) => void,
  ) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    const generation = ++this.generation;
    void this.runCycle(generation);
  }

  stop(): void {
    this.active = false;
    this.generation += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runNow(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    await this.poll(this.generation);
  }

  private async runCycle(generation: number): Promise<void> {
    await this.poll(generation);
    if (!this.active || generation !== this.generation) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle(generation);
    }, this.source.intervalSeconds * 1000);
  }

  private async poll(generation: number): Promise<void> {
    this.publish({ mood: "working", detail: `${this.source.repo}: checking Actions` });
    const current = this.loadMood(generation);
    this.inFlight = current;
    try {
      await current;
    } finally {
      if (this.inFlight === current) {
        this.inFlight = null;
      }
    }
  }

  private async loadMood(generation: number): Promise<void> {
    try {
      const settings = await loadSettings(this.settingsPath);
      if (!settings.token.trim()) {
        if (generation === this.generation) {
          this.publish({ mood: "unknown", detail: "Add a GitHub token in the dashboard" });
        }
        return;
      }

      const snapshot = await new GitHubClient(settings.token.trim()).getWorkflowSnapshot(
        this.source.repo,
      );
      if (generation !== this.generation) {
        return;
      }
      this.publish({
        mood: mapWorkflowHealthToMood(snapshot.health),
        detail:
          snapshot.healthMessage ??
          `${this.source.repo}: ${snapshot.latestWorkflowName ?? "no workflow"}`,
      });
    } catch (error) {
      if (generation === this.generation) {
        this.publish({ mood: "unknown", detail: `${this.source.repo}: ${errorMessage(error)}` });
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
