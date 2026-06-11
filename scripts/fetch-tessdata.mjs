// Downloads Tesseract language data into resources/tessdata for offline OCR.
//
//   npm run fetch:lang            # downloads eng
//   npm run fetch:lang -- deu fra # downloads German + French
//
// Source: tesseract-ocr/tessdata_fast (smaller, recommended for screenshots).
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'resources', 'tessdata');
const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (langs.length === 0) langs.push('eng');

const urlFor = (lang) =>
  `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;

await mkdir(outDir, { recursive: true });

for (const lang of langs) {
  const dest = join(outDir, `${lang}.traineddata`);
  if (existsSync(dest)) {
    console.log(`✓ ${lang}.traineddata already present — skipping`);
    continue;
  }
  process.stdout.write(`Downloading ${lang}.traineddata … `);
  const res = await fetch(urlFor(lang));
  if (!res.ok) {
    console.error(`FAILED (HTTP ${res.status}). Is "${lang}" a valid Tesseract language code?`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`done (${(buf.length / 1_048_576).toFixed(1)} MB)`);
}

console.log(`\nLanguage data is in ${outDir}`);
console.log('It will be seeded into the OCR cache on next app start — fully offline.');
