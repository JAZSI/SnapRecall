import { protocol, net } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { THUMB_PROTOCOL, FILE_PROTOCOL } from '@shared/constants';
import { thumbnailCacheDir } from '@main/shared-main/paths';
import type { AppContext } from './container';

/** Must be called before app.whenReady(). */
export function registerSchemesAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: THUMB_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
    { scheme: FILE_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);
}

/** Serves thumbnails/originals by id, validated. */
export function registerProtocolHandlers(ctx: AppContext): void {
  const idFromUrl = (url: string): number | null => {
    const m = url.match(/\/item\/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  protocol.handle(THUMB_PROTOCOL, async (request) => {
    const id = idFromUrl(request.url);
    if (id === null) return new Response('bad request', { status: 400 });
    const rec = ctx.repo.getById(id);
    if (!rec?.thumbPath) return new Response('not found', { status: 404 });
    const abs = join(thumbnailCacheDir(), rec.thumbPath);
    if (!existsSync(abs)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(abs).toString());
  });

  protocol.handle(FILE_PROTOCOL, async (request) => {
    const id = idFromUrl(request.url);
    if (id === null) return new Response('bad request', { status: 400 });
    const rec = ctx.repo.getById(id);
    if (!rec) return new Response('not found', { status: 404 });
    if (!existsSync(rec.path)) return new Response('missing original', { status: 404 });
    return net.fetch(pathToFileURL(rec.path).toString());
  });
}
