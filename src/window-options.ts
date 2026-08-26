import type { BrowserWindowConstructorOptions } from "electron";

const BUDDY_WINDOW_WIDTH = 168;
const BUDDY_WINDOW_HEIGHT = 156;

export interface BuddyWindowDescriptor {
  name: string;
  x?: number;
  y?: number;
}

export function createBuddyWindowOptions(
  source: BuddyWindowDescriptor,
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: BUDDY_WINDOW_WIDTH,
    height: BUDDY_WINDOW_HEIGHT,
    x: source.x,
    y: source.y,
    minWidth: BUDDY_WINDOW_WIDTH,
    minHeight: BUDDY_WINDOW_HEIGHT,
    maxWidth: BUDDY_WINDOW_WIDTH,
    maxHeight: BUDDY_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    alwaysOnTop: true,
    resizable: false,
    autoHideMenuBar: true,
    title: `build-buddy · ${source.name}`,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
}
