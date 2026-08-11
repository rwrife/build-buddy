import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { GitHubClient } from "./github";
import { AppSettings } from "./shared/types";
import { loadSettings, saveSettings } from "./settings";

let mainWindow: BrowserWindow | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    autoHideMenuBar: true,
    title: "build-buddy · GitHub Repo Manager",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = path.join(app.getAppPath(), "src", "index.html");
  void mainWindow.loadFile(htmlPath);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("settings:get", async () => {
    const settings = await loadSettings(getSettingsPath());
    return settings;
  });

  ipcMain.handle("settings:set", async (_event, partial: Partial<AppSettings>) => {
    return saveSettings(getSettingsPath(), partial);
  });

  ipcMain.handle("github:validate-token", async (_event, token: string) => {
    if (!token || !token.trim()) {
      throw new Error("Token is required.");
    }

    const client = new GitHubClient(token.trim());
    const login = await client.validateToken();
    return { login };
  });

  ipcMain.handle(
    "github:refresh",
    async (_event, payload: { token: string; staleDays: number }) => {
      if (!payload.token || !payload.token.trim()) {
        throw new Error("Token is required.");
      }

      const staleDays = Number.isFinite(payload.staleDays) ? payload.staleDays : 30;
      const client = new GitHubClient(payload.token.trim());
      return client.loadPortfolio(staleDays);
    },
  );

  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
    return true;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
