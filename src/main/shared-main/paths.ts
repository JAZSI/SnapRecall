import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/** Filesystem locations under userData. */

function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function userDataRoot(): string {
  return ensureDir(join(app.getPath('userData')));
}

export function defaultDatabasePath(): string {
  return join(userDataRoot(), 'snaprecall.db');
}

export function thumbnailCacheDir(): string {
  return ensureDir(join(userDataRoot(), 'thumbnails'));
}

export function settingsPath(): string {
  return join(userDataRoot(), 'settings.json');
}

export function logsDir(): string {
  return ensureDir(join(userDataRoot(), 'logs'));
}

/** Bundled Tesseract language data dir. */
export function tessdataDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tessdata')
    : join(app.getAppPath(), 'resources', 'tessdata');
}

export function defaultScreenshotFolder(): string | null {
  const pictures = app.getPath('pictures');
  const candidates = [join(pictures, 'Screenshots'), join(pictures, 'Screenshot'), pictures];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return existsSync(pictures) ? pictures : null;
}
