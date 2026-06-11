import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { z } from 'zod';
import { DEFAULTS } from '@shared/constants';
import { log } from '@main/shared-main/logger';

const PersistedSchema = z.object({
  ocrLanguage: z.string().min(2).default(DEFAULTS.ocrLanguage),
  thumbnailSize: z.number().int().min(96).max(1024).default(DEFAULTS.thumbnailSize),
  databaseLocation: z.string().min(1),
  ocrWorkers: z.number().int().min(1).max(8).default(DEFAULTS.ocrWorkers),
});

export type PersistedSettings = z.infer<typeof PersistedSchema>;

/** Validated, atomic JSON settings store. */
export class JsonSettingsStore {
  private cache: PersistedSettings | null = null;

  constructor(
    private readonly filePath: string,
    private readonly defaultDbPath: string,
  ) {}

  load(): PersistedSettings {
    if (this.cache) return this.cache;
    const fallback: PersistedSettings = {
      ocrLanguage: DEFAULTS.ocrLanguage,
      thumbnailSize: DEFAULTS.thumbnailSize,
      databaseLocation: this.defaultDbPath,
      ocrWorkers: DEFAULTS.ocrWorkers,
    };

    if (!existsSync(this.filePath)) {
      this.cache = fallback;
      this.persist();
      return this.cache;
    }

    try {
      const parsed = PersistedSchema.safeParse(JSON.parse(readFileSync(this.filePath, 'utf-8')));
      this.cache = parsed.success ? parsed.data : fallback;
      if (!parsed.success) log.warn('Invalid settings.json — using defaults', parsed.error.message);
    } catch (err) {
      log.warn('Failed to read settings.json — using defaults', err);
      this.cache = fallback;
    }
    return this.cache;
  }

  update(patch: Partial<PersistedSettings>): PersistedSettings {
    const next = PersistedSchema.parse({ ...this.load(), ...patch });
    this.cache = next;
    this.persist();
    return next;
  }

  private persist(): void {
    if (!this.cache) return;
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf-8');
    renameSync(tmp, this.filePath);
  }
}
