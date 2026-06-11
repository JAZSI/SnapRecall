import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashCan, faFolder } from '@fortawesome/free-solid-svg-icons';
import type { Settings } from '@shared/ipc/contracts';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    window.snap.getSettings().then(setSettings);
  }, []);

  if (!settings)
    return (
      <div className="settings">
        <p className="muted">Loading…</p>
      </div>
    );

  const addFolder = async () => {
    const path = await window.snap.pickFolder();
    if (path) setSettings(await window.snap.addFolder(path));
  };
  const removeFolder = async (path: string) => {
    if (confirm(`Stop watching and remove indexed items from:\n${path}?`))
      setSettings(await window.snap.removeFolder(path));
  };
  const update = async (patch: Partial<Settings>) => setSettings(await window.snap.updateSettings(patch));

  return (
    <div className="settings">
      <header className="hero">
        <div className="hero-row">
          <div>
            <h1>Settings</h1>
            <p className="hero-sub">Folders, OCR, and storage</p>
          </div>
          <button onClick={onClose}>Done</button>
        </div>
      </header>

      <div className="settings-body">
        <section className="card-panel">
          <div className="panel-title">
            <h3>Watched folders</h3>
            <button className="soft" onClick={addFolder}>
              <FontAwesomeIcon icon={faPlus} /> Add folder
            </button>
          </div>
          <ul className="folder-list">
            {settings.folders.map((f) => (
              <li key={f.id}>
                <FontAwesomeIcon icon={faFolder} className="folder-ico" />
                <span title={f.path}>{f.path}</span>
                <button className="icon-danger" title="Remove" onClick={() => removeFolder(f.path)}>
                  <FontAwesomeIcon icon={faTrashCan} />
                </button>
              </li>
            ))}
            {settings.folders.length === 0 && <li className="muted">No folders yet.</li>}
          </ul>
        </section>

        <div className="settings-grid">
          <section className="card-panel">
            <h3>OCR language</h3>
            <input
              value={settings.ocrLanguage}
              onChange={(e) => setSettings({ ...settings, ocrLanguage: e.target.value })}
              onBlur={(e) => update({ ocrLanguage: e.target.value.trim() || 'eng' })}
            />
            <p className="hint">Tesseract code (eng, deu, fra). Restart to apply.</p>
          </section>

          <section className="card-panel">
            <h3>OCR workers</h3>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.ocrWorkers}
              onChange={(e) => update({ ocrWorkers: Number(e.target.value) })}
            />
            <p className="hint">More workers index faster, use more CPU.</p>
          </section>

          <section className="card-panel">
            <h3>Thumbnail size</h3>
            <div className="range-row">
              <input
                type="range"
                min={160}
                max={640}
                step={32}
                value={settings.thumbnailSize}
                onChange={(e) => setSettings({ ...settings, thumbnailSize: Number(e.target.value) })}
                onMouseUp={(e) => update({ thumbnailSize: Number((e.target as HTMLInputElement).value) })}
              />
              <span className="range-val">{settings.thumbnailSize}px</span>
            </div>
            <p className="hint">Applied to newly generated thumbnails.</p>
          </section>

          <section className="card-panel">
            <h3>Database</h3>
            <code className="dbpath">{settings.databaseLocation}</code>
          </section>
        </div>
      </div>
    </div>
  );
}