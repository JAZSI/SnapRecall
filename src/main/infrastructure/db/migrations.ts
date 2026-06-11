/** Forward-only migrations; never edit shipped ones. */

export interface Migration {
  version: number;
  sql: string;
}

const m0001: Migration = {
  version: 1,
  sql: /* sql */ `
    CREATE TABLE folders (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      path      TEXT    NOT NULL UNIQUE,
      enabled   INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
      added_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE screenshots (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id      INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      path           TEXT    NOT NULL UNIQUE,
      filename       TEXT    NOT NULL,
      ocr_text       TEXT    NOT NULL DEFAULT '',
      ocr_confidence INTEGER,
      ocr_lang       TEXT,
      status         TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','done','failed')),
      width          INTEGER,
      height         INTEGER,
      file_size      INTEGER NOT NULL DEFAULT 0,
      content_hash   TEXT,
      thumb_path     TEXT,
      created_at     TEXT,
      modified_at    TEXT,
      indexed_at     TEXT,
      retry_count    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE processing_errors (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
      stage         TEXT NOT NULL CHECK (stage IN ('thumbnail','ocr','read')),
      message       TEXT NOT NULL,
      occurred_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE VIRTUAL TABLE screenshots_fts USING fts5 (
      ocr_text,
      filename,
      content='screenshots',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER screenshots_ai AFTER INSERT ON screenshots BEGIN
      INSERT INTO screenshots_fts(rowid, ocr_text, filename)
      VALUES (new.id, new.ocr_text, new.filename);
    END;

    CREATE TRIGGER screenshots_ad AFTER DELETE ON screenshots BEGIN
      INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text, filename)
      VALUES ('delete', old.id, old.ocr_text, old.filename);
    END;

    CREATE TRIGGER screenshots_au AFTER UPDATE ON screenshots BEGIN
      INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text, filename)
      VALUES ('delete', old.id, old.ocr_text, old.filename);
      INSERT INTO screenshots_fts(rowid, ocr_text, filename)
      VALUES (new.id, new.ocr_text, new.filename);
    END;

    CREATE INDEX idx_screenshots_status   ON screenshots(status);
    CREATE INDEX idx_screenshots_folder   ON screenshots(folder_id);
    CREATE INDEX idx_screenshots_modified ON screenshots(modified_at DESC);
    CREATE INDEX idx_screenshots_created  ON screenshots(created_at DESC);
    CREATE INDEX idx_screenshots_hash     ON screenshots(content_hash);
  `,
};

export const MIGRATIONS: Migration[] = [m0001];
