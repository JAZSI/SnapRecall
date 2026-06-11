import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { MIGRATIONS } from './migrations';
import { log } from '@main/shared-main/logger';

export type DB = Database.Database;

export function openDatabase(dbPath: string): DB {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -16000');

  runMigrations(db);
  return db;
}

function runMigrations(db: DB): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;

  for (const migration of pending) {
    log.info(`Applying migration ${migration.version}`);
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    });
    apply();
  }
}

export function checkpoint(db: DB): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    log.warn('WAL checkpoint failed', err);
  }
}
