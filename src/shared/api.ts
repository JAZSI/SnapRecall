import type {
  SearchRequest,
  SearchResult,
  ScreenshotDTO,
  Settings,
  SettingsUpdate,
  IndexStatus,
  IndexingProgress,
} from './ipc/contracts';

/** Typed surface exposed on window.snap. */
export interface SnapApi {
  search(req: SearchRequest): Promise<SearchResult>;
  getItem(id: number): Promise<ScreenshotDTO | null>;
  reveal(id: number): Promise<void>;
  open(id: number): Promise<void>;
  copyPath(id: number): Promise<void>;
  reindex(id: number): Promise<void>;
  removeItem(id: number): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdate): Promise<Settings>;
  addFolder(path: string): Promise<Settings>;
  removeFolder(path: string): Promise<Settings>;
  pickFolder(): Promise<string | null>;

  getIndexStatus(): Promise<IndexStatus>;
  rescan(): Promise<void>;

  onIndexingProgress(cb: (p: IndexingProgress) => void): () => void;
  onItemAdded(cb: (item: ScreenshotDTO) => void): () => void;
  onItemUpdated(cb: (item: ScreenshotDTO) => void): () => void;
  onItemRemoved(cb: (id: number) => void): () => void;
}
