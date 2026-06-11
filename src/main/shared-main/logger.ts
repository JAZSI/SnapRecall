import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { logsDir } from './paths';

type Level = 'info' | 'warn' | 'error';

function write(level: Level, args: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${args
    .map((a) => (a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`;
  // eslint-disable-next-line no-console
  console[level === 'info' ? 'log' : level](line.trimEnd());
  try {
    appendFileSync(join(logsDir(), 'snaprecall.log'), line);
  } catch {
    /* logging must never throw */
  }
}

export const log = {
  info: (...a: unknown[]) => write('info', a),
  warn: (...a: unknown[]) => write('warn', a),
  error: (...a: unknown[]) => write('error', a),
};
