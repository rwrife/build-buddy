import { AppSettings, PortfolioData } from "./shared/types";
import { PetConfig } from "./pet-config";
import { BuddyMoodUpdate, BuddyWindowInit } from "./buddy-window-manager";

type LifecycleCommand = "run-now" | "pause" | "resume";

declare global {
  interface Window {
    buddyApi: {
      onInit(handler: (init: BuddyWindowInit) => void): () => void;
      onMood(handler: (update: BuddyMoodUpdate) => void): () => void;
    };
    buildBuddyApi: {
      getPetConfig(): Promise<PetConfig>;
      getSettings(): Promise<AppSettings>;
      saveSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
      validateToken(token: string): Promise<{ login: string }>;
      refreshPortfolio(payload: { token: string; staleDays: number }): Promise<PortfolioData>;
      openExternal(url: string): Promise<boolean>;
      onLifecycleCommand(handler: (command: LifecycleCommand) => void): () => void;
    };
  }
}

export {};
