/**
 * TEST / LOCAL-DEV ONLY backend. Stands in for Supabase when VITE_BACKEND=mock.
 *
 *  - Runs the real schema.sql in PGlite (db/load.ts) with the Supabase shim.
 *  - Every request runs as role `authenticated` with auth.uid() set from the
 *    x-user-id header, so RLS and the RPC membership checks are the real ones.
 *  - Realtime: Server-Sent Events. After every successful RPC the server sends
 *    `changed` to the room's subscribers (clients refetch the snapshot).
 *  - Presence: a subscriber's SSE connection = online. Closing the tab = offline.
 *
 * Deliberately NOT production: the user id comes from a header with no auth.
 * This process is never deployed. Production uses Supabase only (see DEPLOY.md).
 */
import http from 'node:http';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from '../db/load';

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const BASE = '/mock-api';
const FN_RE = /^[a-z][a-z0-9_]*$/;
const ARG_RE = /^p_[a-z_]+$/;

let db: PGlite;
let queue: Promise<unknown> = Promise.resolve();

/** PGlite is a single connection: run every database call one at a time. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

interface Sub {
  res: http.ServerResponse;
  user: string;
  room: string;
}
const subs = new Set<Sub>();

function onlineIn(room: string): string[] {
  return [...new Set([...subs].filter((s) => s.room === room).map((s) => s.user))];
}

function sendEvent(res: http.ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcastChanged(rooms: string[] | null) {
  for (const s of subs) {
    if (rooms === null || rooms.includes(s.room)) sendEvent(s.res, 'changed', {});
  }
}

function broadcastPresence(room: string) {
  const online = onlineIn(room);
  for (const s of subs) if (s.room === room) sendEvent(s.res, 'presence', { online });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/** Run `fn` as the given user (or as anonymous when user is empty). */
async function asUser<T>(user: string, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
    return fn(tx as unknown as PGlite);
  });
}

async function handleRpc(fn: string, args: Record<string, unknown>, user: string) {
  if (!FN_RE.test(fn)) throw Object.assign(new Error('bad function name'), { status: 400 });
  const keys = Object.keys(args);
  for (const k of keys) if (!ARG_RE.test(k)) throw Object.assign(new Error(`bad arg ${k}`), { status: 400 });
  const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const sql = `select public."${fn}"(${named}) as result`;
  const values = keys.map((k) => args[k] ?? null);
  return asUser(user, async (tx) => {
    const r = await tx.query<{ result: unknown }>(sql, values);
    return r.rows[0]?.result ?? null;
  });
}

async function handleSnapshot(roomId: string, user: string) {
  return asUser(user, async (tx) => {
    const room = (await tx.query('select * from public.rooms where id = $1', [roomId])).rows[0] ?? null;
    if (!room) return { room: null, songs: [], members: [], messages: [] };
    const songs = (await tx.query('select * from public.songs where room_id = $1 order by position', [roomId])).rows;
    const members = (await tx.query(
      'select user_id, name, avatar, joined_at, is_kicked from public.room_members where room_id = $1 order by joined_at',
      [roomId],
    )).rows;
    const messages = (await tx.query(
      `select * from (select * from public.messages where room_id = $1 order by created_at desc, id desc limit 100)
       m order by created_at, id`,
      [roomId],
    )).rows;
    return { room, songs, members, messages };
  });
}

async function route(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const user = String(req.headers['x-user-id'] ?? '');

  if (req.method === 'GET' && path === `${BASE}/health`) return json(res, 200, { ok: true });

  if (req.method === 'POST' && path === `${BASE}/reset`) {
    // truncate in place: creating a new PGlite instance per reset leaks WebAssembly memory
    // and crashes the process after many test runs
    await serial(async () => {
      await db.exec('truncate public.messages, public.songs, public.member_seen, public.room_members, public.rooms, auth.users cascade');
    });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && path === `${BASE}/signup`) {
    // a browser may remember a user id from an earlier database: recreate it if missing,
    // so a returning friend keeps their identity instead of hitting a foreign-key error
    const body = await readBody(req);
    const wanted = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
    const id = await serial(async () => {
      const r = wanted
        ? await db.query<{ id: string }>('insert into auth.users (id) values ($1) on conflict (id) do update set id = excluded.id returning id', [wanted])
        : await db.query<{ id: string }>('insert into auth.users default values returning id');
      return r.rows[0].id;
    });
    return json(res, 200, { id });
  }

  if (req.method === 'POST' && path.startsWith(`${BASE}/rpc/`)) {
    const fn = path.slice(`${BASE}/rpc/`.length);
    const args = await readBody(req);
    try {
      // a stale browser may send a user id this database has never seen: create that user first,
      // the way a returning anonymous session would be re-established
      const result = await serial(async () => {
        if (/^[0-9a-f-]{36}$/i.test(user)) {
          await db.query('insert into auth.users (id) values ($1) on conflict (id) do nothing', [user]);
        }
        return handleRpc(fn, args, user);
      });
      const room = typeof args.p_room === 'string' ? [args.p_room] : null;
      broadcastChanged(room);
      return json(res, 200, { data: result });
    } catch (e) {
      const err = e as Error & { status?: number };
      return json(res, err.status ?? 400, { message: err.message });
    }
  }

  if (req.method === 'GET' && path.startsWith(`${BASE}/snapshot/`)) {
    const roomId = path.slice(`${BASE}/snapshot/`.length);
    try {
      const snap = await serial(() => handleSnapshot(roomId, user));
      return json(res, 200, snap);
    } catch (e) {
      return json(res, 400, { message: (e as Error).message });
    }
  }

  if (req.method === 'GET' && path === `${BASE}/realtime`) {
    const room = url.searchParams.get('room') ?? '';
    const sub: Sub = { res, user: url.searchParams.get('user') ?? '', room };
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    subs.add(sub);
    broadcastPresence(room);
    req.on('close', () => {
      subs.delete(sub);
      broadcastPresence(room);
    });
    return;
  }

  json(res, 404, { message: 'not found' });
}

export async function startMockServer(port = PORT) {
  db = await createDb();
  const server = http.createServer((req, res) => {
    route(req, res).catch((e) => {
      if (!res.headersSent) json(res, 500, { message: (e as Error).message });
      else res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
  // keep-alive pings so proxies and browsers do not drop idle SSE streams
  setInterval(() => {
    for (const s of subs) s.res.write(': ping\n\n');
  }, 20_000).unref();
  return server;
}
