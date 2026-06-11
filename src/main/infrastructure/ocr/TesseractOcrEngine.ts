import { createWorker, type Worker } from 'tesseract.js';
import sharp from 'sharp';
import { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { OcrEngine, OcrResult } from '@main/domain/ports';
import { log } from '@main/shared-main/logger';

interface PooledWorker {
  worker: Worker;
  busy: boolean;
}

/** Tesseract OCR adapter with a worker pool. */
export class TesseractOcrEngine implements OcrEngine {
  private pool: PooledWorker[] = [];
  private waiters: Array<(w: PooledWorker) => void> = [];
  private initialized = false;

  constructor(
    private readonly lang: string,
    private readonly poolSize: number,
    private readonly tessdataDir: string,
    private readonly cacheDir: string,
  ) {}

  async init(): Promise<void> {
    if (this.initialized) return;

    // Seed cache for offline OCR (avoids langPath URL bug).
    const usedLocal = this.seedLanguageCache();

    for (let i = 0; i < this.poolSize; i++) {
      const worker = await createWorker(this.lang, 1, { cachePath: this.cacheDir });
      this.pool.push({ worker, busy: false });
    }
    this.initialized = true;
    log.info(
      `OCR engine ready (lang=${this.lang}, workers=${this.poolSize}, source=${usedLocal ? 'bundled' : 'cache-or-download'})`,
    );
  }

  /** Seed cache from bundled traineddata. */
  private seedLanguageCache(): boolean {
    const cacheTarget = join(this.cacheDir, `${this.lang}.traineddata`);
    if (existsSync(cacheTarget)) return true; // already cached

    if (!existsSync(this.cacheDir)) mkdirSync(this.cacheDir, { recursive: true });

    const plain = join(this.tessdataDir, `${this.lang}.traineddata`);
    const gz = join(this.tessdataDir, `${this.lang}.traineddata.gz`);

    try {
      if (existsSync(plain)) {
        copyFileSync(plain, cacheTarget);
        return true;
      }
      if (existsSync(gz)) {
        writeFileSync(cacheTarget, gunzipSync(readFileSync(gz)));
        return true;
      }
    } catch (err) {
      log.warn(`Failed to seed OCR language cache for ${this.lang}`, err);
    }
    return false; // will download once if no local data
  }

  async recognize(imagePath: string): Promise<OcrResult> {
    if (!this.initialized) await this.init();
    const pw = await this.acquire();
    try {
      const pre = await sharp(imagePath, { failOn: 'none' })
        .rotate()
        .grayscale()
        .normalize()
        .toFormat('png')
        .toBuffer();

      const { data } = await pw.worker.recognize(pre);
      return {
        text: (data.text ?? '').trim(),
        confidence: typeof data.confidence === 'number' ? Math.round(data.confidence) : null,
        lang: this.lang,
      };
    } finally {
      this.release(pw);
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(this.pool.map((p) => p.worker.terminate()));
    this.pool = [];
    this.initialized = false;
  }

  private acquire(): Promise<PooledWorker> {
    const free = this.pool.find((p) => !p.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(pw: PooledWorker): void {
    const next = this.waiters.shift();
    if (next) {
      next(pw);
      return;
    }
    pw.busy = false;
  }
}
