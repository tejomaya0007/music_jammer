/**
 * YouTube link parsing for the Add bar.
 * Accepts watch, youtu.be, music, shorts, embed, live, v, and a bare 11-char id.
 * Anything else is reported back as invalid so the UI can show it.
 */

export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface ParsedLinks {
  ids: string[];
  invalid: string[];
}

function idFromUrl(token: string): string | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(token) ? token : `https://${token}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return VIDEO_ID_RE.test(parts[0] ?? '') ? parts[0] : null;
  }
  if (YT_HOSTS.has(host)) {
    if (parts[0] === 'watch') {
      const v = url.searchParams.get('v') ?? '';
      return VIDEO_ID_RE.test(v) ? v : null;
    }
    if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '')) {
      return VIDEO_ID_RE.test(parts[1] ?? '') ? parts[1] : null;
    }
  }
  return null;
}

/** Parse one token (a link, or a bare id). Returns null if it is not a YouTube video. */
export function parseVideoId(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  if (VIDEO_ID_RE.test(t)) return t;
  return idFromUrl(t);
}

/**
 * Parse pasted text that may contain several links separated by spaces,
 * commas, or new lines. Keeps order, keeps duplicates (the queue allows them).
 */
export function parseVideoLinks(input: string): ParsedLinks {
  const ids: string[] = [];
  const invalid: string[] = [];
  for (const token of input.split(/[\s,]+/).filter(Boolean)) {
    const id = parseVideoId(token);
    if (id) ids.push(id);
    else invalid.push(token);
  }
  return { ids, invalid };
}
