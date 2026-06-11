import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faLayerGroup,
  faGear,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons';
import type { SearchResultItem, IndexStatus, IndexingProgress } from '@shared/ipc/contracts';
import { useDebounce } from './hooks/useDebounce';
import { ResultCard } from './features/search/ResultCard';
import { Viewer } from './features/viewer/Viewer';
import { SettingsPanel } from './features/settings/SettingsPanel';

const PAGE = 60;
type View = 'library' | 'settings';

export function App(): JSX.Element {
  const [view, setView] = useState<View>('library');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [progress, setProgress] = useState<IndexingProgress | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  const lastRefreshRef = useRef(0);

  const debouncedQuery = useDebounce(query, 120);
  const hasMore = items.length < total;

  const runSearch = useCallback(async (q: string) => {
    const my = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await window.snap.search({ q, limit: PAGE, offset: 0 });
      if (my === reqIdRef.current) {
        setItems(res.items);
        setTotal(res.total);
      }
    } finally {
      if (my === reqIdRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || items.length >= total) return;
    const my = reqIdRef.current;
    setLoadingMore(true);
    try {
      const res = await window.snap.search({ q: debouncedQuery, limit: PAGE, offset: items.length });
      if (my === reqIdRef.current) {
        setItems((prev) => [...prev, ...res.items]);
        setTotal(res.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, items.length, total, debouncedQuery]);

  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const ob = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: '500px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    const refreshStatus = () => window.snap.getIndexStatus().then(setStatus);
    refreshStatus();

    const offProgress = window.snap.onIndexingProgress((p) => {
      setProgress(p.scanning ? p : null);
      refreshStatus();
    });
    const offAdded = window.snap.onItemAdded(() => {
      refreshStatus();
      const now = Date.now();
      if (items.length <= PAGE && now - lastRefreshRef.current > 1500) {
        lastRefreshRef.current = now;
        runSearch(debouncedQuery);
      }
    });
    const offRemoved = window.snap.onItemRemoved((id) => {
      refreshStatus();
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    });
    return () => {
      offProgress();
      offAdded();
      offRemoved();
    };
  }, [items.length, debouncedQuery, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setView('library');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const busy = (status?.queued ?? 0) + (status?.processing ?? 0);
  const indexing = (progress?.scanning ?? false) || busy > 0;
  const indexLabel = progress?.scanning
    ? `Scanning ${progress.processed}/${progress.total}`
    : busy > 0
      ? `Indexing ${busy} left`
      : `${status?.done ?? 0} indexed`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>SnapRecall</strong>
          <span>screenshot search</span>
        </div>

        <nav className="nav">
          <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>
            <FontAwesomeIcon icon={faLayerGroup} />
            <span>Library</span>
          </button>
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            <FontAwesomeIcon icon={faGear} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="topbar-right">
          <div className="status-cluster">
            <span className={`pulse ${indexing ? 'on' : ''}`} />
            <span>{indexLabel}</span>
            {status && status.failed > 0 ? <span className="failed">· {status.failed} failed</span> : null}
          </div>
          <button className="ghost-btn" title="Rescan" onClick={() => window.snap.rescan()}>
            <FontAwesomeIcon icon={faArrowsRotate} />
          </button>
        </div>
      </header>

      {progress?.scanning && progress.total > 0 && (
        <div className="topbar-progress">
          <span style={{ width: `${(progress.processed / progress.total) * 100}%` }} />
        </div>
      )}

      <div className="content">
        {view === 'library' ? (
          <>
            <header className="hero">
              <div className="hero-row">
                  <h1>Library</h1>
                  <p className="hero-sub">
                    {loading ? 'Searching…' : `Showing ${items.length} of ${total.toLocaleString()}`}
                  </p>
              </div>
              <div className="searchbox">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="searchbox-icon" />
                <input
                  ref={searchRef}
                  value={query}
                  autoFocus
                  placeholder="Search the text inside your screenshots…"
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>Ctrl F</kbd>
              </div>
            </header>

            <main className="results">
              {items.length === 0 && !loading ? (
                <Empty query={query} empty={!!status && status.total === 0} onSettings={() => setView('settings')} />
              ) : (
                <>
                  <div className="grid">
                    {items.map((item) => (
                      <ResultCard key={item.id} item={item} onOpen={(it) => setViewerId(it.id)} />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="load-more" ref={sentinelRef}>
                      <button onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? 'Loading…' : `Load more · ${(total - items.length).toLocaleString()} left`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </>
        ) : (
          <SettingsPanel onClose={() => setView('library')} />
        )}
      </div>

      {viewerId !== null && (
        <Viewer id={viewerId} onClose={() => setViewerId(null)} onRemoved={() => runSearch(debouncedQuery)} />
      )}
    </div>
  );
}

function Empty({
  query,
  empty,
  onSettings,
}: {
  query: string;
  empty: boolean;
  onSettings: () => void;
}): JSX.Element {
  return (
    <div className="empty">
      <span className="empty-mark">
        <FontAwesomeIcon icon={faMagnifyingGlass} size="lg" />
      </span>
      {query ? (
        <>
          <h2>No matches for “{query}”</h2>
          <p>Try fewer or different words.</p>
        </>
      ) : empty ? (
        <>
          <h2>No screenshots yet</h2>
          <p>Add a folder to start building your searchable library.</p>
          <button onClick={onSettings}>Open Settings</button>
        </>
      ) : (
        <>
          <h2>Search your screenshots</h2>
          <p>Type above to find anything by the text inside the image.</p>
        </>
      )}
    </div>
  );
}