/**
 * localStorage wrappers. Storage can be blocked or throw (private windows,
 * cleared site data), so every access is guarded and the app still works without it.
 */

export function readStore(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* ignore: the app keeps working for this session */
  }
}
