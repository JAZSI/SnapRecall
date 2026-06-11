/** Cross-process constants. No Node/DOM APIs. */

export const SUPPORTED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.gif',
] as const;

export const DEFAULTS = {
  ocrLanguage: 'eng',
  thumbnailSize: 480,
  searchPageSize: 50,
  searchDebounceMs: 120,
  maxRetries: 3,
  ocrWorkers: 2,
} as const;

export const THUMB_PROTOCOL = 'snap-thumb';
export const FILE_PROTOCOL = 'snap-file';

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed';

export function isSupportedExtension(ext: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}
