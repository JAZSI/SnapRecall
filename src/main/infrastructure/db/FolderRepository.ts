import type { DB } from './database';
import type { FolderDTO } from '@shared/ipc/contracts';

interface FolderRow {
  id: number;
  path: string;
  enabled: number;
}

export class FolderRepository {
  constructor(private readonly db: DB) {}

  list(): FolderDTO[] {
    const rows = this.db.prepare('SELECT id, path, enabled FROM folders ORDER BY id').all() as FolderRow[];
    return rows.map((r) => ({ id: r.id, path: r.path, enabled: !!r.enabled }));
  }

  enabledPaths(): string[] {
    return this.list()
      .filter((f) => f.enabled)
      .map((f) => f.path);
  }

  add(path: string): FolderDTO {
    this.db.prepare('INSERT OR IGNORE INTO folders (path, enabled) VALUES (?, 1)').run(path);
    const row = this.db.prepare('SELECT id, path, enabled FROM folders WHERE path = ?').get(path) as FolderRow;
    return { id: row.id, path: row.path, enabled: !!row.enabled };
  }

  remove(path: string): FolderDTO | null {
    const row = this.db.prepare('SELECT id, path, enabled FROM folders WHERE path = ?').get(path) as
      | FolderRow
      | undefined;
    if (!row) return null;
    // cascade removes screenshots + FTS rows
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(row.id);
    return { id: row.id, path: row.path, enabled: !!row.enabled };
  }

  findIdForPath(filePath: string): number | null {
    const folders = this.list();
    let best: FolderDTO | null = null;
    for (const f of folders) {
      if (filePath.startsWith(f.path) && (!best || f.path.length > best.path.length)) best = f;
    }
    return best?.id ?? null;
  }
}
