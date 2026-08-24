import { spawn, spawnSync } from "node:child_process";
import { LocalCommandConfig } from "./local-config";

const MAX_CAPTURE_CHARS = 1024 * 1024;

export interface LocalCommandResult {
  command: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
}

interface LocalCommandExecution {
  result: Promise<LocalCommandResult>;
  cancel(force?: boolean): void;
}

type ResultHandler = (result: LocalCommandResult) => void | Promise<void>;
type ErrorHandler = (error: unknown) => void;

export function formatLocalCommandLog(result: LocalCommandResult): string {
  const outcome = result.cancelled
    ? "CANCELLED"
    : result.timedOut
      ? "TIMEOUT"
      : result.exitCode === 0
        ? "PASS"
        : "FAIL";
  const exitCode = result.exitCode ?? "n/a";
  return `[local-poller] ${outcome} exit=${exitCode} duration=${result.durationMs}ms`;
}

export class LocalCommandPoller {
  private active = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private execution: LocalCommandExecution | null = null;
  private inFlight: Promise<LocalCommandResult> | null = null;

  constructor(
    private readonly config: LocalCommandConfig,
    private readonly onResult: ResultHandler,
    private readonly onError: ErrorHandler = (error) => {
      console.error("[local-poller] callback error", error);
    },
  ) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    const generation = ++this.generation;
    void this.startGeneration(generation);
  }

  stop(force = false): void {
    this.active = false;
    this.generation += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.execution?.cancel(force);
  }

  async runNow(): Promise<LocalCommandResult> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const execution = startLocalCommand(this.config);
    this.execution = execution;
    const currentRun = execution.result.then(async (result) => {
      try {
        await this.onResult(result);
      } catch (error) {
        this.reportError(error);
      }
      return result;
    });
    this.inFlight = currentRun;

    try {
      return await currentRun;
    } finally {
      if (this.inFlight === currentRun) {
        this.inFlight = null;
        this.execution = null;
      }
    }
  }

  private async startGeneration(generation: number): Promise<void> {
    const previousRun = this.inFlight;
    if (previousRun) {
      try {
        await previousRun;
      } catch (error) {
        this.reportError(error);
      }
    }

    if (this.active && generation === this.generation) {
      await this.runCycle(generation);
    }
  }

  private reportError(error: unknown): void {
    try {
      this.onError(error);
    } catch {
      // Error reporting must never stop the polling loop.
    }
  }

  private async runCycle(generation: number): Promise<void> {
    try {
      await this.runNow();
    } catch (error) {
      this.reportError(error);
    }

    if (!this.active || generation !== this.generation) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle(generation);
    }, this.config.intervalSeconds * 1000);
  }
}

export function runLocalCommand(config: LocalCommandConfig): Promise<LocalCommandResult> {
  return startLocalCommand(config).result;
}

function startLocalCommand(config: LocalCommandConfig): LocalCommandExecution {
  const startedAt = Date.now();
  let timedOut = false;
  let cancelled = false;
  let settled = false;
  let stdout = "";
  let stderr = "";

  const child = spawn(config.command, {
    cwd: config.cwd,
    shell: true,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout = appendCapped(stdout, chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = appendCapped(stderr, chunk);
  });

  let resolveResult: (result: LocalCommandResult) => void;
  const result = new Promise<LocalCommandResult>((resolve) => {
    resolveResult = resolve;
  });

  const finish = (exitCode: number | null, error?: Error): void => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timeoutTimer);
    if (error) {
      stderr = appendCapped(stderr, error.message);
    }
    resolveResult({
      command: config.command,
      exitCode,
      durationMs: Date.now() - startedAt,
      timedOut,
      cancelled,
      stdout,
      stderr,
    });
  };

  child.once("error", (error) => finish(null, error));
  child.once("close", (code) => finish(code));

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(child.pid);
  }, config.timeoutSeconds * 1000);

  return {
    result,
    cancel: (force = false) => {
      if (settled) {
        return;
      }
      cancelled = true;
      terminateProcessTree(child.pid, force);
    },
  };
}

function terminateProcessTree(pid: number | undefined, force = false): void {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    const killed = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    if (killed.status !== 0) {
      killSingleProcess(pid, "SIGKILL");
    }
    return;
  }

  const processGroup = -pid;
  killSingleProcess(processGroup, force ? "SIGKILL" : "SIGTERM");
  if (!force) {
    const escalation = setTimeout(() => {
      killSingleProcess(processGroup, "SIGKILL");
    }, 250);
    escalation.unref();
  }
}

function killSingleProcess(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch {
    // Process already exited or is no longer accessible.
  }
}

function appendCapped(current: string, chunk: string): string {
  if (current.length >= MAX_CAPTURE_CHARS) {
    return current;
  }
  return (current + chunk).slice(0, MAX_CAPTURE_CHARS);
}
