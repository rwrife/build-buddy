import { contextBridge, ipcRenderer } from "electron";
import type { BuddyMoodUpdate, BuddyWindowInit } from "./buddy-window-manager";

const buddyApi = {
  onInit: (handler: (init: BuddyWindowInit) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, init: BuddyWindowInit): void => handler(init);
    ipcRenderer.on("buddy:init", listener);
    return () => ipcRenderer.off("buddy:init", listener);
  },
  onMood: (handler: (update: BuddyMoodUpdate) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: BuddyMoodUpdate): void =>
      handler(update);
    ipcRenderer.on("buddy:mood", listener);
    return () => ipcRenderer.off("buddy:mood", listener);
  },
};

contextBridge.exposeInMainWorld("buddyApi", buddyApi);
