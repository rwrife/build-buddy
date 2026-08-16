import { contextBridge, ipcRenderer } from "electron";
import { AppSettings, PortfolioData } from "./shared/types";

type LifecycleCommand = "run-now" | "pause" | "resume";

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  saveSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke("settings:set", partial),
  validateToken: (token: string): Promise<{ login: string }> =>
    ipcRenderer.invoke("github:validate-token", token),
  refreshPortfolio: (payload: {
    token: string;
    staleDays: number;
  }): Promise<PortfolioData> => ipcRenderer.invoke("github:refresh", payload),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("shell:open-external", url),
  onLifecycleCommand: (handler: (command: LifecycleCommand) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: LifecycleCommand) => {
      handler(command);
    };

    ipcRenderer.on("lifecycle:command", listener);
    return () => {
      ipcRenderer.off("lifecycle:command", listener);
    };
  },
};

contextBridge.exposeInMainWorld("buildBuddyApi", api);
