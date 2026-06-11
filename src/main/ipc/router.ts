import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron';
import { z } from 'zod';
import { CH } from '@shared/ipc/channels';
import {
  SearchRequestSchema,
  IdRequestSchema,
  PathRequestSchema,
  SettingsUpdateSchema,
} from '@shared/ipc/contracts';
import { toScreenshotDTO } from '@main/application/dto';
import { log } from '@main/shared-main/logger';
import type { AppContext } from '@main/bootstrap/container';

type Handler<T> = (payload: T) => unknown | Promise<unknown>;

/** Registers IPC handlers; validates payloads. */
export function registerIpc(ctx: AppContext): void {
  const handle = <S extends z.ZodTypeAny>(channel: string, schema: S, fn: Handler<z.infer<S>>): void => {
    ipcMain.handle(channel, async (_event, raw) => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        log.warn(`Invalid payload on ${channel}`, parsed.error.message);
        throw new Error(`Invalid request on ${channel}`);
      }
      return fn(parsed.data);
    });
  };

  const empty = z.unknown().optional();

  handle(CH.searchQuery, SearchRequestSchema, (req) => ctx.search.query(req));

  handle(CH.itemGet, IdRequestSchema, ({ id }) => {
    const rec = ctx.repo.getById(id);
    return rec ? toScreenshotDTO(rec) : null;
  });

  handle(CH.itemReveal, IdRequestSchema, ({ id }) => {
    const rec = ctx.repo.getById(id);
    if (rec) shell.showItemInFolder(rec.path);
  });

  handle(CH.itemOpen, IdRequestSchema, async ({ id }) => {
    const rec = ctx.repo.getById(id);
    if (rec) await shell.openPath(rec.path);
  });

  handle(CH.itemCopyPath, IdRequestSchema, ({ id }) => {
    const rec = ctx.repo.getById(id);
    if (rec) clipboard.writeText(rec.path);
  });

  handle(CH.itemReindex, IdRequestSchema, ({ id }) => {
    ctx.repo.resetForRetry(id);
    ctx.queue.enqueueId(id);
  });

  handle(CH.itemRemove, IdRequestSchema, async ({ id }) => {
    const rec = ctx.repo.deleteById(id);
    if (rec?.thumbPath) await ctx.thumbs.remove(rec.thumbPath);
  });

  handle(CH.settingsGet, empty, () => ctx.settings.get());
  handle(CH.settingsUpdate, SettingsUpdateSchema, (patch) => ctx.settings.update(patch));
  handle(CH.folderAdd, PathRequestSchema, ({ path }) => ctx.settings.addFolder(path));
  handle(CH.folderRemove, PathRequestSchema, ({ path }) => ctx.settings.removeFolder(path));

  handle(CH.folderPick, empty, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  handle(CH.indexStatus, empty, () => ctx.repo.status());
  handle(CH.indexRescan, empty, () => {
    void ctx.indexing.fullScan();
  });
}

export function unregisterIpc(): void {
  for (const channel of Object.values(CH)) ipcMain.removeHandler(channel);
}
