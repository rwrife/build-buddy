import { AppSettings, PortfolioData } from "./shared/types";
import { PetConfig } from "./pet-config";

type LifecycleCommand = "run-now" | "pause" | "resume";

declare global {
  interface Window {
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
