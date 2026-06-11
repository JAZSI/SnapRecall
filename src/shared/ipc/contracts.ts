import { z } from 'zod';

/** Zod schemas for inbound IPC payloads. */

export const SearchRequestSchema = z.object({
  q: z.string().max(512).default(''),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  from: z.string().optional(),
  to: z.string().optional(),
  folderId: z.number().int().optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const IdRequestSchema = z.object({ id: z.number().int().positive() });
export type IdRequest = z.infer<typeof IdRequestSchema>;

export const PathRequestSchema = z.object({ path: z.string().min(1) });
export type PathRequest = z.infer<typeof PathRequestSchema>;

export const SettingsUpdateSchema = z.object({
  ocrLanguage: z.string().min(2).max(32).optional(),
  thumbnailSize: z.number().int().min(96).max(1024).optional(),
  databaseLocation: z.string().min(1).optional(),
  ocrWorkers: z.number().int().min(1).max(8).optional(),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

// response DTOs (produced by main)

export interface ScreenshotDTO {
  id: number;
  path: string;
  filename: string;
  ocrText: string;
  ocrConfidence: number | null;
  status: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  thumbUrl: string | null;
  fileUrl: string;
  createdAt: string | null;
  modifiedAt: string | null;
  indexedAt: string | null;
}

export interface SearchResultItem extends ScreenshotDTO {
  snippet: string;
  rank: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  query: string;
}

export interface IndexStatus {
  queued: number;
  processing: number;
  failed: number;
  done: number;
  total: number;
}

export interface IndexingProgress {
  processed: number;
  total: number;
  currentPath: string | null;
  scanning: boolean;
}

export interface FolderDTO {
  id: number;
  path: string;
  enabled: boolean;
}

export interface Settings {
  folders: FolderDTO[];
  ocrLanguage: string;
  thumbnailSize: number;
  databaseLocation: string;
  ocrWorkers: number;
}
