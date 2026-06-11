import type { JsonSettingsStore } from '@main/infrastructure/config/JsonSettingsStore';
import type { FolderRepository } from '@main/infrastructure/db/FolderRepository';
import type { Settings, SettingsUpdate } from '@shared/ipc/contracts';

/** Merges scalar settings + folder list. */
export class SettingsService {
  private listeners: Array<() => void> = [];

  constructor(
    private readonly store: JsonSettingsStore,
    private readonly folders: FolderRepository,
  ) {}

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  get(): Settings {
    const s = this.store.load();
    return {
      folders: this.folders.list(),
      ocrLanguage: s.ocrLanguage,
      thumbnailSize: s.thumbnailSize,
      databaseLocation: s.databaseLocation,
      ocrWorkers: s.ocrWorkers,
    };
  }

  update(patch: SettingsUpdate): Settings {
    this.store.update(patch);
    this.notify();
    return this.get();
  }

  addFolder(path: string): Settings {
    this.folders.add(path);
    this.notify();
    return this.get();
  }

  removeFolder(path: string): Settings {
    this.folders.remove(path);
    this.notify();
    return this.get();
  }
}
