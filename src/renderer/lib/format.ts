export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Split FTS snippet into highlighted parts. */
export function splitSnippet(snippet: string): Array<{ text: string; hit: boolean }> {
  const parts: Array<{ text: string; hit: boolean }> = [];
  const regex = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(snippet)) !== null) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), hit: false });
    parts.push({ text: m[1], hit: true });
    last = regex.lastIndex;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), hit: false });
  return parts;
}
