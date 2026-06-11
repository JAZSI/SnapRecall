import type { DB } from './database';
import type { ProcessingStatus } from '@shared/constants';
import type { ScreenshotRecord, UpsertInput } from '@main/domain/ports';
import type { IndexStatus } from '@shared/ipc/contracts';

interface Row {
  id: number;
  folder_id: number | null;
  path: string;
  filename: string;
  ocr_text: string;
  ocr_confidence: number | null;
  ocr_lang: string | null;
  status: ProcessingStatus;
  width: number | null;
  height: number | null;
  file_size: number;
  content_hash: string | null;
  thumb_path: string | null;
  created_at: string | null;
  modified_at: string | null;
  indexed_at: string | null;
  retry_count: number;
}

function toRecord(r: Row): ScreenshotRecord {
  return {
    id: r.id,
    folderId: r.folder_id,
    path: r.path,
    filename: r.filename,
    ocrText: r.ocr_text,
    ocrConfidence: r.ocr_confidence,
    ocrLang: r.ocr_lang,
    status: r.status,
    width: r.width,
    height: r.height,
    fileSize: r.file_size,
    contentHash: r.content_hash,
    thumbPath: r.thumb_path,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
    indexedAt: r.indexed_at,
    retryCount: r.retry_count,
  };
}

/** SQLite screenshot repository (synchronous writes). */
export class ScreenshotRepository {
  constructor(private readonly db: DB) {}

  /** Upsert by path; flags if processing needed. */
  upsert(input: UpsertInput): { id: number; needsProcessing: boolean } {
    const existing = this.db
      .prepare('SELECT id, status, modified_at FROM screenshots WHERE path = ?')
      .get(input.path) as { id: number; status: ProcessingStatus; modified_at: string | null } | undefined;

    if (!existing) {
      const info = this.db
        .prepare(
          `INSERT INTO screenshots (folder_id, path, filename, file_size, modified_at, created_at, status)
           VALUES (@folderId, @path, @filename, @fileSize, @modifiedAt, @createdAt, 'pending')`,
        )
        .run(input);
      return { id: Number(info.lastInsertRowid), needsProcessing: true };
    }

    const changed = existing.modified_at !== input.modifiedAt;
    this.db
      .prepare(
        `UPDATE screenshots
            SET file_size = @fileSize, modified_at = @modifiedAt,
                status = CASE WHEN @changed = 1 THEN 'pending' ELSE status END
          WHERE id = @id`,
      )
      .run({ ...input, id: existing.id, changed: changed ? 1 : 0 });

    const needsProcessing = changed || existing.status === 'pending' || existing.status === 'failed';
    return { id: existing.id, needsProcessing };
  }

  markProcessing(id: number): void {
    this.db.prepare(`UPDATE screenshots SET status = 'processing' WHERE id = ?`).run(id);
  }

  finalize(
    id: number,
    data: {
      ocrText: string;
      confidence: number | null;
      lang: string;
      contentHash: string;
      width: number | null;
      height: number | null;
      thumbPath: string | null;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE screenshots
            SET ocr_text = @ocrText, ocr_confidence = @confidence, ocr_lang = @lang,
                content_hash = @contentHash, width = @width, height = @height,
                thumb_path = @thumbPath, status = 'done',
                indexed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = @id`,
      )
      .run({ id, ...data });
  }

  markFailed(id: number, stage: 'thumbnail' | 'ocr' | 'read', message: string): number {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE screenshots SET status = 'failed', retry_count = retry_count + 1 WHERE id = ?`)
        .run(id);
      this.db
        .prepare(`INSERT INTO processing_errors (screenshot_id, stage, message) VALUES (?, ?, ?)`)
        .run(id, stage, message.slice(0, 1000));
      return this.db.prepare('SELECT retry_count FROM screenshots WHERE id = ?').get(id) as
        | { retry_count: number }
        | undefined;
    });
    return tx()?.retry_count ?? 0;
  }

  resetForRetry(id: number): void {
    this.db.prepare(`UPDATE screenshots SET status = 'pending' WHERE id = ?`).run(id);
  }

  getById(id: number): ScreenshotRecord | null {
    const r = this.db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id) as Row | undefined;
    return r ? toRecord(r) : null;
  }

  getByPath(path: string): ScreenshotRecord | null {
    const r = this.db.prepare('SELECT * FROM screenshots WHERE path = ?').get(path) as Row | undefined;
    return r ? toRecord(r) : null;
  }

  deleteByPath(path: string): ScreenshotRecord | null {
    const record = this.getByPath(path);
    if (record) this.db.prepare('DELETE FROM screenshots WHERE id = ?').run(record.id);
    return record;
  }

  deleteById(id: number): ScreenshotRecord | null {
    const record = this.getById(id);
    if (record) this.db.prepare('DELETE FROM screenshots WHERE id = ?').run(id);
    return record;
  }

  /** Ids needing work (resume queue on boot). */
  pendingIds(): number[] {
    const rows = this.db
      .prepare(`SELECT id FROM screenshots WHERE status IN ('pending','processing') ORDER BY id`)
      .all() as { id: number }[];
    return rows.map((r) => r.id);
  }

  allPaths(): Set<string> {
    const rows = this.db.prepare('SELECT path FROM screenshots').all() as { path: string }[];
    return new Set(rows.map((r) => r.path));
  }

  recent(limit: number, offset: number): ScreenshotRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM screenshots WHERE status = 'done'
          ORDER BY modified_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Row[];
    return rows.map(toRecord);
  }

  countDone(): number {
    return (this.db.prepare(`SELECT COUNT(*) c FROM screenshots WHERE status = 'done'`).get() as { c: number }).c;
  }

  status(): IndexStatus {
    const row = this.db
      .prepare(
        `SELECT
           SUM(status='pending')    AS queued,
           SUM(status='processing') AS processing,
           SUM(status='failed')     AS failed,
           SUM(status='done')       AS done,
           COUNT(*)                 AS total
         FROM screenshots`,
      )
      .get() as { queued: number; processing: number; failed: number; done: number; total: number };
    return {
      queued: row.queued ?? 0,
      processing: row.processing ?? 0,
      failed: row.failed ?? 0,
      done: row.done ?? 0,
      total: row.total ?? 0,
    };
  }
}
