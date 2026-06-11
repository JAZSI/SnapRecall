/** IPC channel names. */
export const CH = {
  // renderer -> main
  searchQuery: 'search:query',
  itemGet: 'item:get',
  itemReveal: 'item:reveal',
  itemOpen: 'item:open',
  itemCopyPath: 'item:copyPath',
  itemReindex: 'item:reindex',
  itemRemove: 'item:remove',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  folderAdd: 'folders:add',
  folderRemove: 'folders:remove',
  folderPick: 'folders:pick',
  indexStatus: 'index:status',
  indexRescan: 'index:rescan',

  // main -> renderer
  indexingProgress: 'indexing:progress',
  itemAdded: 'item:added',
  itemUpdated: 'item:updated',
  itemRemoved: 'item:removed',
} as const;

export type RequestChannel =
  | typeof CH.searchQuery
  | typeof CH.itemGet
  | typeof CH.itemReveal
  | typeof CH.itemOpen
  | typeof CH.itemCopyPath
  | typeof CH.itemReindex
  | typeof CH.itemRemove
  | typeof CH.settingsGet
  | typeof CH.settingsUpdate
  | typeof CH.folderAdd
  | typeof CH.folderRemove
  | typeof CH.folderPick
  | typeof CH.indexStatus
  | typeof CH.indexRescan;

export type EventChannel =
  | typeof CH.indexingProgress
  | typeof CH.itemAdded
  | typeof CH.itemUpdated
  | typeof CH.itemRemoved;
