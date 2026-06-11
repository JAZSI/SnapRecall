import type { BrowserWindow } from 'electron';
import { openDatabase, checkpoint, type DB } from '@main/infrastructure/db/database';
import { ScreenshotRepository } from '@main/infrastructure/db/ScreenshotRepository';
import { FolderRepository } from '@main/infrastructure/db/FolderRepository';
import { SharpThumbnailGenerator } from '@main/infrastructure/images/SharpThumbnailGenerator';
import { TesseractOcrEngine } from '@main/infrastructure/ocr/TesseractOcrEngine';
import { ChokidarFileWatcher } from '@main/infrastructure/watcher/ChokidarFileWatcher';
import { JsonSettingsStore } from '@main/infrastructure/config/JsonSettingsStore';
import { ProcessingQueue } from '@main/application/indexing/ProcessingQueue';
import { IndexingService } from '@main/application/indexing/IndexingService';
import { SearchService } from '@main/application/search/SearchService';
import { SettingsService } from '@main/application/settings/SettingsService';
import {
  defaultDatabasePath,
  defaultScreenshotFolder,
  settingsPath,
  thumbnailCacheDir,
  tessdataDir,
  userDataRoot,
} from '@main/shared-main/paths';
import { CH } from '@shared/ipc/channels';
import { log } from '@main/shared-main/logger';

export interface AppContext {
  db: DB;
  repo: ScreenshotRepository;
  folders: FolderRepository;
  settings: SettingsService;
  search: SearchService;
  indexing: IndexingService;
  thumbs: SharpThumbnailGenerator;
  ocr: TesseractOcrEngine;
  queue: ProcessingQueue;
  dispose(): Promise<void>;
}

export function createContext(getWindow: () => BrowserWindow | null): AppContext {
  const settingsStore = new JsonSettingsStore(settingsPath(), defaultDatabasePath());
  const persisted = settingsStore.load();

  const db = openDatabase(persisted.databaseLocation);
  const repo = new ScreenshotRepository(db);
  const folders = new FolderRepository(db);

  // first run: seed default folder
  if (folders.list().length === 0) {
    const def = defaultScreenshotFolder();
    if (def) folders.add(def);
  }

  const thumbs = new SharpThumbnailGenerator(thumbnailCacheDir());
  const ocr = new TesseractOcrEngine(
    persisted.ocrLanguage,
    persisted.ocrWorkers,
    tessdataDir(),
    userDataRoot(),
  );
  const watcher = new ChokidarFileWatcher();
  const settings = new SettingsService(settingsStore, folders);
  const search = new SearchService(db, repo);

  const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload);

  const queue = new ProcessingQueue({
    repo,
    ocr,
    thumbs,
    thumbnailSize: () => settings.get().thumbnailSize,
    concurrency: () => settings.get().ocrWorkers,
    onItem: (kind, dto) => send(kind === 'added' ? CH.itemAdded : CH.itemUpdated, dto),
    onProgress: () => send(CH.indexStatus, repo.status()),
  });

  const indexing = new IndexingService({
    repo,
    folders,
    watcher,
    queue,
    thumbs,
    emitProgress: (p) => send(CH.indexingProgress, p),
    emitRemoved: (id) => send(CH.itemRemoved, id),
  });

  // re-watch + rescan on settings change
  settings.onChange(() => {
    indexing.refreshWatcher();
    void indexing.fullScan();
  });

  void ocr.init().catch((err) => log.error('OCR init failed', err));

  return {
    db,
    repo,
    folders,
    settings,
    search,
    indexing,
    thumbs,
    ocr,
    queue,
    async dispose() {
      await watcher.close();
      await ocr.dispose();
      checkpoint(db);
      db.close();
    },
  };
}
