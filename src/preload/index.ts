import { contextBridge, ipcRenderer } from 'electron';
import { CH } from '@shared/ipc/channels';
import type { SnapApi } from '@shared/api';
import type {
  SearchRequest,
  SettingsUpdate,
  ScreenshotDTO,
  IndexingProgress,
} from '@shared/ipc/contracts';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: SnapApi = {
  search: (req: SearchRequest) => ipcRenderer.invoke(CH.searchQuery, req),
  getItem: (id) => ipcRenderer.invoke(CH.itemGet, { id }),
  reveal: (id) => ipcRenderer.invoke(CH.itemReveal, { id }),
  open: (id) => ipcRenderer.invoke(CH.itemOpen, { id }),
  copyPath: (id) => ipcRenderer.invoke(CH.itemCopyPath, { id }),
  reindex: (id) => ipcRenderer.invoke(CH.itemReindex, { id }),
  removeItem: (id) => ipcRenderer.invoke(CH.itemRemove, { id }),

  getSettings: () => ipcRenderer.invoke(CH.settingsGet),
  updateSettings: (patch: SettingsUpdate) => ipcRenderer.invoke(CH.settingsUpdate, patch),
  addFolder: (path) => ipcRenderer.invoke(CH.folderAdd, { path }),
  removeFolder: (path) => ipcRenderer.invoke(CH.folderRemove, { path }),
  pickFolder: () => ipcRenderer.invoke(CH.folderPick),

  getIndexStatus: () => ipcRenderer.invoke(CH.indexStatus),
  rescan: () => ipcRenderer.invoke(CH.indexRescan),

  onIndexingProgress: (cb: (p: IndexingProgress) => void) => subscribe(CH.indexingProgress, cb),
  onItemAdded: (cb: (item: ScreenshotDTO) => void) => subscribe(CH.itemAdded, cb),
  onItemUpdated: (cb: (item: ScreenshotDTO) => void) => subscribe(CH.itemUpdated, cb),
  onItemRemoved: (cb: (id: number) => void) => subscribe(CH.itemRemoved, cb),
};

contextBridge.exposeInMainWorld('snap', api);
