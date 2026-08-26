export interface BuddySourceDriver {
  start(): void;
  stop(): void;
  runNow(): Promise<void>;
}

export class BuddySourceRuntime {
  private active = false;
  private disposed = false;

  constructor(private readonly driver: BuddySourceDriver) {}

  start(): void {
    if (this.disposed || this.active) {
      return;
    }
    this.active = true;
    this.driver.start();
  }

  pause(): void {
    if (this.disposed || !this.active) {
      return;
    }
    this.active = false;
    this.driver.stop();
  }

  resume(): void {
    this.start();
  }

  async runNow(): Promise<void> {
    if (this.disposed) {
      return;
    }
    await this.driver.runNow();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.pause();
    this.disposed = true;
  }

  get isPaused(): boolean {
    return !this.active;
  }
}
