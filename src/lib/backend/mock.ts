import type { Backend, RoomSnapshot, RealtimeHandlers } from './types';
import { readStore, writeStore } from '../storage';

/**
 * Local test/dev backend: talks to server/mock-server.ts (PGlite running the
 * real schema.sql). Same RPCs, same RLS, realtime via Server-Sent Events.
 * Enabled only with VITE_BACKEND=mock. Vite proxies /mock-api to the server.
 */

const BASE = '/mock-api';
const USER_KEY = 'jam:mock-user';

async function call<T>(path: string, init: RequestInit & { user?: string } = {}): Promise<T> {
  const { user, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', 'x-user-id': user ?? '', ...(rest.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string; data?: T };
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
  return (body.data ?? body) as T;
}

let currentUser: string | null = null;

export const mockBackend: Backend = {
  async signIn() {
    const stored = readStore(USER_KEY);
    if (stored) {
      currentUser = stored;
      return stored;
    }
    const { id } = await call<{ id: string }>('/signup', { method: 'POST' });
    writeStore(USER_KEY, id);
    currentUser = id;
    return id;
  },

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    return call<T>(`/rpc/${fn}`, {
      method: 'POST',
      body: JSON.stringify(args),
      user: currentUser ?? readStore(USER_KEY) ?? '',
    });
  },

  async snapshot(roomId: string): Promise<RoomSnapshot> {
    return call<RoomSnapshot>(`/snapshot/${roomId}`, { user: currentUser ?? readStore(USER_KEY) ?? '' });
  },

  subscribe(roomId: string, userId: string, h: RealtimeHandlers) {
    const url = `${BASE}/realtime?room=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userId)}`;
    const es = new EventSource(url);
    es.addEventListener('changed', () => h.onChange());
    es.addEventListener('presence', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { online: string[] };
      h.onPresence(data.online);
    });
    // every (re)connect: reload the snapshot, as the Supabase adapter does
    es.onopen = () => h.onChange();
    return () => es.close();
  },
};

/** Test helper: wipe the mock database. */
export async function resetMockBackend() {
  await fetch(`${BASE}/reset`, { method: 'POST' });
  writeStore(USER_KEY, null);
  currentUser = null;
}
