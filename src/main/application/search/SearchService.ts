import type { DB } from '@main/infrastructure/db/database';
import type { ScreenshotRepository } from '@main/infrastructure/db/ScreenshotRepository';
import { buildMatchExpression } from '@main/domain/SearchQuery';
import { toScreenshotDTO } from '@main/application/dto';
import { THUMB_PROTOCOL, FILE_PROTOCOL } from '@shared/constants';
import type { SearchRequest, SearchResult, SearchResultItem } from '@shared/ipc/contracts';

interface SearchRow {
  id: number;
  folder_id: number | null;
  path: string;
  filename: string;
  ocr_text: string;
  ocr_confidence: number | null;
  status: string;
  width: number | null;
  height: number | null;
  file_size: number;
  thumb_path: string | null;
  created_at: string | null;
  modified_at: string | null;
  indexed_at: string | null;
  snippet: string;
  rank: number;
}

export class SearchService {
  constructor(
    private readonly db: DB,
    private readonly repo: ScreenshotRepository,
  ) {}

  query(req: SearchRequest): SearchResult {
    const match = buildMatchExpression(req.q);

    // empty query -> recent
    if (!match) {
      const items = this.repo.recent(req.limit, req.offset).map((r) => ({
        ...toScreenshotDTO(r),
        snippet: r.ocrText.slice(0, 160),
        rank: 0,
      }));
      return { items, total: this.repo.countDone(), query: req.q };
    }

    const filters: string[] = ['screenshots_fts MATCH @match'];
    const params: Record<string, unknown> = { match, limit: req.limit, offset: req.offset };
    if (req.from) {
      filters.push('s.modified_at >= @from');
      params.from = req.from;
    }
    if (req.to) {
      filters.push('s.modified_at <= @to');
      params.to = req.to;
    }
    if (typeof req.folderId === 'number') {
      filters.push('s.folder_id = @folderId');
      params.folderId = req.folderId;
    }
    const where = filters.join(' AND ');

    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) c FROM screenshots_fts
             JOIN screenshots s ON s.id = screenshots_fts.rowid
            WHERE ${where}`,
        )
        .get(params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT s.*,
                snippet(screenshots_fts, 0, '[', ']', ' … ', 12) AS snippet,
                bm25(screenshots_fts, 1.0, 0.5) AS rank
           FROM screenshots_fts
           JOIN screenshots s ON s.id = screenshots_fts.rowid
          WHERE ${where}
          ORDER BY rank
          LIMIT @limit OFFSET @offset`,
      )
      .all(params) as SearchRow[];

    const items: SearchResultItem[] = rows.map((r) => ({
      id: r.id,
      path: r.path,
      filename: r.filename,
      ocrText: r.ocr_text,
      ocrConfidence: r.ocr_confidence,
      status: r.status,
      width: r.width,
      height: r.height,
      fileSize: r.file_size,
      thumbUrl: r.thumb_path ? `${THUMB_PROTOCOL}://item/${r.id}` : null,
      fileUrl: `${FILE_PROTOCOL}://item/${r.id}`,
      createdAt: r.created_at,
      modifiedAt: r.modified_at,
      indexedAt: r.indexed_at,
      snippet: r.snippet,
      rank: r.rank,
    }));

    return { items, total, query: req.q };
  }
}
