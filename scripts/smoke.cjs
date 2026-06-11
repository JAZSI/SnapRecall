// Runtime smoke test: verifies better-sqlite3 loads under Electron's Node ABI and
// that the FTS5 schema + search queries behave.
// Run with Electron's node:  $env:ELECTRON_RUN_AS_NODE=1; npx electron scripts/smoke.cjs
try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      ocr_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'done'
    );
    CREATE VIRTUAL TABLE screenshots_fts USING fts5(
      ocr_text, filename, content='screenshots', content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER ai AFTER INSERT ON screenshots BEGIN
      INSERT INTO screenshots_fts(rowid, ocr_text, filename)
      VALUES (new.id, new.ocr_text, new.filename);
    END;
  `);

  const insert = db.prepare('INSERT INTO screenshots (path, filename, ocr_text) VALUES (?, ?, ?)');
  insert.run('/a/aws.png', 'aws.png', 'unrelated content here');
  insert.run('/a/note.png', 'note.png', 'AWS timeout error connection refused');

  const rows = db
    .prepare(
      `SELECT s.filename,
              snippet(screenshots_fts, 0, '[', ']', '…', 8) AS snip,
              bm25(screenshots_fts, 1.0, 0.5) AS rank
         FROM screenshots_fts
         JOIN screenshots s ON s.id = screenshots_fts.rowid
        WHERE screenshots_fts MATCH ?
        ORDER BY rank`,
    )
    .all('aws* AND timeout*');

  console.log('FTS results:', JSON.stringify(rows));
  const matchOk = rows.length === 1 && rows[0].filename === 'note.png';

  const phrase = db
    .prepare(
      `SELECT s.filename FROM screenshots_fts
         JOIN screenshots s ON s.id = screenshots_fts.rowid
        WHERE screenshots_fts MATCH ?`,
    )
    .all('"connection refused"');
  console.log('phrase results:', JSON.stringify(phrase));
  const phraseOk = phrase.length === 1 && phrase[0].filename === 'note.png';

  db.close();
  console.log(matchOk && phraseOk ? 'SMOKE_OK' : 'SMOKE_FAIL');
  process.exit(matchOk && phraseOk ? 0 : 1);
} catch (err) {
  console.error('SMOKE_ERROR', err);
  process.exit(1);
}
