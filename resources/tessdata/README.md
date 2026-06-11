# Tesseract language data

SnapRecall reads OCR language data from this folder and loads it on startup, so
OCR runs fully offline with no network access.

## Add a language

Download it automatically:

```bash
npm run fetch:lang            # English (eng)
npm run fetch:lang -- deu fra # add more by Tesseract language code
```

Or place a file here manually — either form works:

- `eng.traineddata` (uncompressed)
- `eng.traineddata.gz` (gzipped; decompressed automatically)

Language files come from [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast),
which is compact and well suited to screenshots.

## Selecting the language

Set the OCR language in **Settings** using its Tesseract code (`eng`, `deu`,
`fra`, …). The matching `*.traineddata` file must be present in this folder.
