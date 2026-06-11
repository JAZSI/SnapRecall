import sharp from 'sharp';
import { join } from 'node:path';
import { existsSync, mkdirSync, promises as fsp } from 'node:fs';
import type { ThumbnailGenerator, ThumbnailResult } from '@main/domain/ports';

const RATIO_H = 10 / 16; // card thumbnail box ratio

/** Sharp thumbnails: uniform fixed-size cover crop. */
export class SharpThumbnailGenerator implements ThumbnailGenerator {
  constructor(private readonly cacheDir: string) {}

  async generate(imagePath: string, contentHash: string, size: number): Promise<ThumbnailResult> {
    const h = Math.round(size * RATIO_H);
    const rel = this.relPath(contentHash, size);
    const abs = join(this.cacheDir, rel);

    const meta = await sharp(imagePath, { failOn: 'none' }).metadata();

    if (!existsSync(abs)) {
      mkdirSync(join(this.cacheDir, rel.split('/').slice(0, -1).join('/')), { recursive: true });
      await sharp(imagePath, { failOn: 'none' })
        .rotate()
        .resize(size, h, { fit: 'cover', position: 'attention' })
        .webp({ quality: 80 })
        .toFile(abs);
    }

    return { thumbPath: rel, width: meta.width ?? size, height: meta.height ?? h };
  }

  async remove(thumbPath: string): Promise<void> {
    try {
      await fsp.unlink(join(this.cacheDir, thumbPath));
    } catch {
      /* already gone */
    }
  }

  private relPath(hash: string, size: number): string {
    const a = hash.slice(0, 2);
    const b = hash.slice(2, 4);
    return `${a}/${b}/${hash}_${size}.webp`;
  }
}
