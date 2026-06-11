import chokidar, { type FSWatcher } from 'chokidar';
import { extname } from 'node:path';
import { isSupportedExtension } from '@shared/constants';
import type { FileWatcher, WatcherEvent } from '@main/domain/ports';
import { log } from '@main/shared-main/logger';

/** chokidar adapter; waits for stable writes. */
export class ChokidarFileWatcher implements FileWatcher {
  private watcher: FSWatcher | null = null;
  private handler: ((event: WatcherEvent, filePath: string) => void) | null = null;

  watch(paths: string[]): void {
    void this.close();
    if (paths.length === 0) return;

    this.watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 700, pollInterval: 100 },
      ignored: (p: string) => {
        const ext = extname(p);
        return ext !== '' && !isSupportedExtension(ext);
      },
      depth: 8,
    });

    this.watcher
      .on('add', (p) => this.emit('add', p))
      .on('change', (p) => this.emit('change', p))
      .on('unlink', (p) => this.emit('unlink', p))
      .on('error', (err) => log.warn('watcher error', err));

    log.info(`Watching ${paths.length} folder(s)`);
  }

  on(handler: (event: WatcherEvent, filePath: string) => void): void {
    this.handler = handler;
  }

  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private emit(event: WatcherEvent, filePath: string): void {
    if (event !== 'unlink' && !isSupportedExtension(extname(filePath))) return;
    this.handler?.(event, filePath);
  }
}
