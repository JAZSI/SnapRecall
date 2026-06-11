import { promises as fsp } from 'node:fs';
import { join, extname, basename } from 'node:path';
import type { ScreenshotRepository } from '@main/infrastructure/db/ScreenshotRepository';
import type { FolderRepository } from '@main/infrastructure/db/FolderRepository';
import { isSupportedExtension } from '@shared/constants';

type ProgressFn = (processed: number, total: number, currentPath: string | null) => void;
type EnqueueFn = (id: number) => void;

/** Walks folders, reconciles DB, enqueues work. */
export class InitialScanService {
  constructor(
    private readonly repo: ScreenshotRepository,
    private readonly folders: FolderRepository,
  ) {}

  async scan(onProgress: ProgressFn, enqueue: EnqueueFn): Promise<{ discovered: number; removed: number }> {
    const folderList = this.folders.list().filter((f) => f.enabled);
    const knownBefore = this.repo.allPaths();
    const seen = new Set<string>();

    // count first for progress
    const files: string[] = [];
    for (const folder of folderList) {
      await this.walk(folder.path, (file) => files.push(file));
    }
    const total = files.length;
    let processed = 0;

    for (const file of files) {
      seen.add(file);
      try {
        const stat = await fsp.stat(file);
        const folderId = this.folders.findIdForPath(file);
        const { id, needsProcessing } = this.repo.upsert({
          folderId,
          path: file,
          filename: basename(file),
          fileSize: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          createdAt: stat.birthtime.toISOString(),
        });
        if (needsProcessing) enqueue(id);
      } catch {
        /* file vanished mid-scan */
      }
      processed++;
      if (processed % 10 === 0 || processed === total) onProgress(processed, total, file);
    }

    // prune rows for vanished files
    let removed = 0;
    for (const path of knownBefore) {
      if (seen.has(path)) continue;
      if (!folderList.some((f) => path.startsWith(f.path))) continue;
      const rec = this.repo.deleteByPath(path);
      if (rec) removed++;
    }

    onProgress(processed, total, null);
    return { discovered: total, removed };
  }

  private async walk(dir: string, onFile: (file: string) => void, depth = 0): Promise<void> {
    if (depth > 12) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(full, onFile, depth + 1);
      } else if (entry.isFile() && isSupportedExtension(extname(entry.name))) {
        onFile(full);
      }
    }
  }
}
