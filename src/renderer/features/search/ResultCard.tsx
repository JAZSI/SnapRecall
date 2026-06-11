import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { SearchResultItem } from '@shared/ipc/contracts';
import { formatDate, splitSnippet } from '../../lib/format';

interface Props {
  item: SearchResultItem;
  onOpen: (item: SearchResultItem) => void;
}

export function ResultCard({ item, onOpen }: Props): JSX.Element {
  const parts = splitSnippet(item.snippet || item.ocrText.slice(0, 160));
  return (
    <button className="card" onClick={() => onOpen(item)} title={item.path}>
      <div className="card-media">
        {item.thumbUrl ? (
          <img src={item.thumbUrl} alt={item.filename} loading="lazy" />
        ) : (
          <span className="card-ph">
            <FontAwesomeIcon icon={item.status === 'failed' ? faTriangleExclamation : faImage} />
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="card-name">{item.filename}</div>
        <div className="card-date">{formatDate(item.modifiedAt)}</div>
        <p className="card-snippet">
          {parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
        </p>
      </div>
    </button>
  );
}
