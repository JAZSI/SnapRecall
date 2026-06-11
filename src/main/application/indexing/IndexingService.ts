import { promises as fsp } from 'node:fs';
import { basename } from 'node:path';
import type { ScreenshotRepository } from '@main/infrastructure/db/ScreenshotRepository';
import type { FolderRepository } from '@main/infrastructure/db/FolderRepository';
import type { FileWatcher, ThumbnailGenerator, WatcherEvent } from '@main/domain/ports';
import type { ProcessingQueue } from './ProcessingQueue';
import { InitialScanService } from './InitialScanService';
import { log } from '@main/shared-main/logger';
import type { IndexingProgress } from '@shared/ipc/contracts';

interface IndexingDeps {
  repo: ScreenshotRepository;
  folders: FolderRepository;
  watcher: FileWatcher;
  queue: ProcessingQueue;
  thumbs: ThumbnailGenerator;
  emitProgress: (p: IndexingProgress) => void;
  emitRemoved: (id: number) => void;
}

/** Connects watcher + scan to the queue. */
export class IndexingService {
  private readonly scanner: InitialScanService;
  private scanning = false;
  private scanProcessed = 0;
  private scanTotal = 0;

  constructor(private readonly deps: IndexingDeps) {
    this.scanner = new InitialScanService(deps.repo, deps.folders);
    deps.watcher.on((event, filePath) => void this.onWatcherEvent(event, filePath));
  }

  start(): void {
    this.refreshWatcher();
    void this.resumePending();
    void this.fullScan();
  }

  refreshWatcher(): void {
    this.deps.watcher.watch(this.deps.folders.enabledPaths());
  }

  /** Re-enqueue work left pending on last close. */
  private async resumePending(): Promise<void> {
    const ids = this.deps.repo.pendingIds();
    for (const id of ids) this.deps.queue.enqueueId(id);
    if (ids.length) log.info(`Resumed ${ids.length} pending item(s)`);
  }

  async fullScan(): Promise<void> {
    this.scanning = true;
    this.scanProcessed = 0;
    this.scanTotal = 0;
    this.emitProgress(null);

    const result = await this.scanner.scan((processed, total, current) => {
      this.scanProcessed = processed;
      this.scanTotal = total;
      this.emitProgress(current);
    }, (id) => this.deps.queue.enqueueId(id));

    this.scanning = false;
    this.emitProgress(null);
    log.info(`Initial scan complete: ${result.discovered} discovered, ${result.removed} pruned`);
  }

  private async onWatcherEvent(event: WatcherEvent, filePath: string): Promise<void> {
    try {
      if (event === 'unlink') {
        const removed = this.deps.repo.deleteByPath(filePath);
        if (removed) {
          if (removed.thumbPath) await this.deps.thumbs.remove(removed.thumbPath);
          this.deps.emitRemoved(removed.id);
        }
        return;
      }

      const stat = await fsp.stat(filePath);
      const folderId = this.deps.folders.findIdForPath(filePath);
      const { id, needsProcessing } = this.deps.repo.upsert({
        folderId,
        path: filePath,
        filename: basename(filePath),
        fileSize: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        createdAt: stat.birthtime.toISOString(),
      });
      if (needsProcessing) this.deps.queue.enqueueId(id);
    } catch (err) {
      log.warn(`watcher event ${event} failed for ${filePath}`, err);
    }
  }

  private emitProgress(currentPath: string | null): void {
    this.deps.emitProgress({
      processed: this.scanProcessed,
      total: this.scanTotal,
      currentPath,
      scanning: this.scanning,
    });
  }
}
