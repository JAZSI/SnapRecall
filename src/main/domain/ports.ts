import type { ProcessingStatus } from '@shared/constants';

/** Ports: swappable OCR / DB / watcher seams. */

export interface ScreenshotRecord {
  id: number;
  folderId: number | null;
  path: string;
  filename: string;
  ocrText: string;
  ocrConfidence: number | null;
  ocrLang: string | null;
  status: ProcessingStatus;
  width: number | null;
  height: number | null;
  fileSize: number;
  contentHash: string | null;
  thumbPath: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  indexedAt: string | null;
  retryCount: number;
}

export interface UpsertInput {
  folderId: number | null;
  path: string;
  filename: string;
  fileSize: number;
  modifiedAt: string | null;
  createdAt: string | null;
}

export interface OcrResult {
  text: string;
  confidence: number | null;
  lang: string;
}

export interface OcrEngine {
  init(): Promise<void>;
  recognize(imagePath: string): Promise<OcrResult>;
  dispose(): Promise<void>;
}

export interface ThumbnailResult {
  thumbPath: string; // relative to the thumbnail cache root
  width: number;
  height: number;
}

export interface ThumbnailGenerator {
  generate(imagePath: string, contentHash: string, size: number): Promise<ThumbnailResult>;
  remove(thumbPath: string): Promise<void>;
}

export type WatcherEvent = 'add' | 'change' | 'unlink';

export interface FileWatcher {
  watch(paths: string[]): void;
  on(handler: (event: WatcherEvent, filePath: string) => void): void;
  close(): Promise<void>;
}
