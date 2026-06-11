import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUpRightFromSquare,
  faFolderOpen,
  faCopy,
  faArrowsRotate,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { ScreenshotDTO } from '@shared/ipc/contracts';
import { formatBytes, formatDate } from '../../lib/format';

interface Props {
  id: number;
  onClose: () => void;
  onRemoved: (id: number) => void;
}

export function Viewer({ id, onClose, onRemoved }: Props): JSX.Element {
  const [item, setItem] = useState<ScreenshotDTO | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    window.snap.getItem(id).then((dto) => active && setItem(dto));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return <div className="modal-backdrop" onClick={onClose} />;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="viewer-stage">
          {error ? (
            <div className="viewer-missing">Original file is missing or was moved.</div>
          ) : (
            <img src={item.fileUrl} alt={item.filename} onError={() => setError(true)} />
          )}
        </div>

        <aside className="viewer-side">
          <h2 title={item.path}>{item.filename}</h2>

          <div className="chips">
            <span className="chip">{formatDate(item.modifiedAt)}</span>
            <span className="chip">{formatBytes(item.fileSize)}</span>
            {item.width && item.height ? (
              <span className="chip">
                {item.width}×{item.height}
              </span>
            ) : null}
            <span className={`chip ${item.status === 'failed' ? 'chip-bad' : 'chip-ok'}`}>{item.status}</span>
            {item.ocrConfidence != null ? <span className="chip">{item.ocrConfidence}% OCR</span> : null}
          </div>

          <div className="viewer-actions">
            <button onClick={() => window.snap.open(item.id)}>
              <FontAwesomeIcon icon={faUpRightFromSquare} /> Open
            </button>
            <button onClick={() => window.snap.reveal(item.id)}>
              <FontAwesomeIcon icon={faFolderOpen} /> Reveal
            </button>
            <button onClick={() => window.snap.copyPath(item.id)}>
              <FontAwesomeIcon icon={faCopy} /> Copy path
            </button>
            <button onClick={() => window.snap.reindex(item.id)}>
              <FontAwesomeIcon icon={faArrowsRotate} /> Re-index
            </button>
            <button
              className="danger"
              onClick={async () => {
                await window.snap.removeItem(item.id);
                onRemoved(item.id);
                onClose();
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} /> Remove
            </button>
          </div>

          <div className="viewer-ocr">
            <h3>Extracted text</h3>
            {item.ocrText ? <pre>{item.ocrText}</pre> : <p className="muted">No text was extracted.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}