import { promises as fsp } from 'node:fs';
import { basename } from 'node:path';
import type { ScreenshotRepository } from '@main/infrastructure/db/ScreenshotRepository';
import type { OcrEngine, ThumbnailGenerator } from '@main/domain/ports';
import { toScreenshotDTO } from '@main/application/dto';
import { hashFile } from '@main/shared-main/hash';
import { log } from '@main/shared-main/logger';
import { DEFAULTS } from '@shared/constants';
import type { ScreenshotDTO } from '@shared/ipc/contracts';

interface QueueDeps {
  repo: ScreenshotRepository;
  ocr: OcrEngine;
  thumbs: ThumbnailGenerator;
  thumbnailSize: () => number;
  concurrency: () => number;
  onItem: (kind: 'added' | 'updated', dto: ScreenshotDTO) => void;
  onProgress: () => void;
}

/** Bounded-concurrency, durable (DB-backed) queue. */
export class ProcessingQueue {
  private readonly pending = new Set<number>();
  private readonly queue: number[] = [];
  private active = 0;

  constructor(private readonly deps: QueueDeps) {}

  enqueueId(id: number): void {
    if (this.pending.has(id)) return;
    this.pending.add(id);
    this.queue.push(id);
    this.pump();
  }

  get size(): number {
    return this.queue.length + this.active;
  }

  private pump(): void {
    const limit = Math.max(1, this.deps.concurrency());
    while (this.active < limit && this.queue.length > 0) {
      const id = this.queue.shift()!;
      this.active++;
      void this.process(id).finally(() => {
        this.active--;
        this.pending.delete(id);
        this.deps.onProgress();
        this.pump();
      });
    }
  }

  private async process(id: number): Promise<void> {
    const { repo, ocr, thumbs } = this.deps;
    const record = repo.getById(id);
    if (!record) return;

    // skip if file vanished
    try {
      await fsp.access(record.path);
    } catch {
      repo.deleteById(id);
      return;
    }

    repo.markProcessing(id);

    let hash: string;
    try {
      hash = await hashFile(record.path);
    } catch (err) {
      this.fail(id, 'read', err);
      return;
    }

    let thumbPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const t = await thumbs.generate(record.path, hash, this.deps.thumbnailSize());
      thumbPath = t.thumbPath;
      width = t.width;
      height = t.height;
    } catch (err) {
      log.warn(`thumbnail failed for ${record.path}`, err);
      repo.markFailed(id, 'thumbnail', String(err));
      // OCR proceeds even if thumbnail failed
    }

    try {
      const result = await ocr.recognize(record.path);
      repo.finalize(id, {
        ocrText: result.text,
        confidence: result.confidence,
        lang: result.lang,
        contentHash: hash,
        width,
        height,
        thumbPath,
      });
      const dto = toScreenshotDTO(repo.getById(id)!);
      this.deps.onItem('added', dto);
    } catch (err) {
      this.fail(id, 'ocr', err);
    }
  }

  private fail(id: number, stage: 'thumbnail' | 'ocr' | 'read', err: unknown): void {
    const retries = this.deps.repo.markFailed(id, stage, String(err));
    log.warn(`${stage} failed (attempt ${retries}) for item ${id}: ${String(err)}`);
    if (retries < DEFAULTS.maxRetries) {
      const delay = 500 * 2 ** retries;
      setTimeout(() => {
        this.deps.repo.resetForRetry(id);
        this.enqueueId(id);
      }, delay);
    }
  }
}

export function filenameOf(path: string): string {
  return basename(path);
}
