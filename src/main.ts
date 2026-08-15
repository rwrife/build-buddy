import path from "node:path";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { GitHubClient } from "./github";
import { AppSettings } from "./shared/types";
import { loadSettings, saveSettings } from "./settings";

const MIN_WINDOW_WIDTH = 980;
const MIN_WINDOW_HEIGHT = 720;

let mainWindow: BrowserWindow | null = null;
let lifecyclePaused = false;
let persistWindowTimer: ReturnType<typeof setTimeout> | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

async function createWindow(): Promise<void> {
  const settings = await loadSettings(getSettingsPath());
  lifecyclePaused = settings.uiPaused;

  const windowBounds = settings.windowBounds;

  mainWindow = new BrowserWindow({
    width: windowBounds?.width ?? 1240,
    height: windowBounds?.height ?? 860,
    x: windowBounds?.x,
    y: windowBounds?.y,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
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

  registerWindowPersistence(mainWindow);
  registerWindowContextMenu(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerWindowPersistence(window: BrowserWindow): void {
  const persistBounds = (): void => {
    if (window.isDestroyed()) {
      return;
    }

    const bounds = window.getBounds();
    void saveSettings(getSettingsPath(), {
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(MIN_WINDOW_WIDTH, bounds.width),
        height: Math.max(MIN_WINDOW_HEIGHT, bounds.height),
      },
    });
  };

  const schedulePersist = (): void => {
    if (persistWindowTimer) {
      clearTimeout(persistWindowTimer);
    }

    persistWindowTimer = setTimeout(() => {
      persistWindowTimer = null;
      persistBounds();
    }, 250);
  };

  window.on("move", schedulePersist);
  window.on("resize", schedulePersist);
  window.on("close", persistBounds);
}

function registerWindowContextMenu(window: BrowserWindow): void {
  window.webContents.on("context-menu", () => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Run now",
        click: () => {
          window.webContents.send("lifecycle:command", "run-now");
        },
      },
      {
        label: lifecyclePaused ? "Resume" : "Pause",
        click: () => {
          void setLifecyclePaused(!lifecyclePaused);
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    menu.popup({ window });
  });
}

async function setLifecyclePaused(paused: boolean): Promise<void> {
  lifecyclePaused = paused;
  await saveSettings(getSettingsPath(), { uiPaused: paused });

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("lifecycle:command", paused ? "pause" : "resume");
}

function registerIpcHandlers(): void {
  ipcMain.handle("settings:get", async () => {
    const settings = await loadSettings(getSettingsPath());
    lifecyclePaused = settings.uiPaused;
    return settings;
  });

  ipcMain.handle("settings:set", async (_event, partial: Partial<AppSettings>) => {
    const saved = await saveSettings(getSettingsPath(), partial);
    lifecyclePaused = saved.uiPaused;
    return saved;
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

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
