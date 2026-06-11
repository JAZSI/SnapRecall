import { app, BrowserWindow, session } from 'electron';
import { createWindow } from '@main/bootstrap/createWindow';
import { createContext, type AppContext } from '@main/bootstrap/container';
import { registerSchemesAsPrivileged, registerProtocolHandlers } from '@main/bootstrap/registerProtocols';
import { registerIpc, unregisterIpc } from '@main/ipc/router';
import { log } from '@main/shared-main/logger';

let mainWindow: BrowserWindow | null = null;
let context: AppContext | null = null;

registerSchemesAsPrivileged();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    applyContentSecurityPolicy();

    context = createContext(() => mainWindow);
    registerProtocolHandlers(context);
    registerIpc(context);

    mainWindow = createWindow();
    context.indexing.start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
  if (!context) return;
  event.preventDefault();
  const ctx = context;
  context = null;
  unregisterIpc();
  try {
    await ctx.dispose();
  } catch (err) {
    log.error('shutdown error', err);
  }
  app.exit(0);
});

function applyContentSecurityPolicy(): void {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  // HMR-friendly in dev; strict in prod
  const csp = isDev
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: snap-thumb: snap-file: http://localhost:* ws://localhost:*; img-src 'self' data: blob: snap-thumb: snap-file:;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: snap-thumb: snap-file:; connect-src 'self' snap-thumb: snap-file:;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
}
