/**
 * Build a safe FTS5 MATCH from user input.
 * Quoted = phrase, bare = prefix, multiple = AND.
 */
export function buildMatchExpression(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  const parts: string[] = [];
  const phraseRegex = /"([^"]+)"/g;
  let remainder = input;

  // quoted phrases first
  let match: RegExpExecArray | null;
  while ((match = phraseRegex.exec(input)) !== null) {
    const phrase = sanitizePhrase(match[1]);
    if (phrase) parts.push(`"${phrase}"`);
  }
  remainder = input.replace(phraseRegex, ' ');

  // bare tokens -> prefix matches
  for (const token of remainder.split(/\s+/)) {
    const clean = sanitizeToken(token);
    if (clean) parts.push(`${clean}*`);
  }

  if (parts.length === 0) return null;
  return parts.join(' AND ');
}

/** Strip FTS5 syntax characters. */
function sanitizeToken(token: string): string {
  return token.replace(/[^\p{L}\p{N}_]/gu, '');
}

function sanitizePhrase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map(sanitizeToken)
    .filter(Boolean)
    .join(' ');
}
