import { THUMB_PROTOCOL, FILE_PROTOCOL } from '@shared/constants';
import type { ScreenshotRecord } from '@main/domain/ports';
import type { ScreenshotDTO } from '@shared/ipc/contracts';

export function toScreenshotDTO(r: ScreenshotRecord): ScreenshotDTO {
  return {
    id: r.id,
    path: r.path,
    filename: r.filename,
    ocrText: r.ocrText,
    ocrConfidence: r.ocrConfidence,
    status: r.status,
    width: r.width,
    height: r.height,
    fileSize: r.fileSize,
    thumbUrl: r.thumbPath ? `${THUMB_PROTOCOL}://item/${r.id}` : null,
    fileUrl: `${FILE_PROTOCOL}://item/${r.id}`,
    createdAt: r.createdAt,
    modifiedAt: r.modifiedAt,
    indexedAt: r.indexedAt,
  };
}
