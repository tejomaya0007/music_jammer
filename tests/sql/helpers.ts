import type { PGlite } from '@electric-sql/pglite';
import { createDb } from '../../db/load';

export type Db = PGlite;

export async function freshDb(): Promise<Db> {
  return createDb();
}

/** Insert an anonymous user, the way Supabase anonymous sign-in does. */
export async function newUser(db: Db): Promise<string> {
  const r = await db.query<{ id: string }>('insert into auth.users default values returning id');
  return r.rows[0].id;
}

/**
 * Run SQL as a signed-in user: role `authenticated`, auth.uid() = uid.
 * Throws the Postgres error message on failure (same text the app shows).
 */
export async function asUser<T = Record<string, unknown>>(
  db: Db,
  uid: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    const r = await tx.query<T>(sql, params);
    return r.rows;
  });
}

/** Like asUser but returns the error instead of throwing. */
export async function tryAs(
  db: Db,
  uid: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  try {
    return { ok: true, rows: await asUser(db, uid, sql, params) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Superuser SQL, for test setup and clock manipulation only. */
export async function sudo<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

export interface RoomInfo {
  id: string;
  code: string;
}

export async function createRoom(db: Db, uid: string, name: string): Promise<RoomInfo> {
  const [row] = await asUser<{ r: RoomInfo }>(db, uid, 'select public.create_room($1) as r', [name]);
  return row.r;
}

export async function joinRoom(db: Db, uid: string, code: string, name: string): Promise<RoomInfo> {
  const [row] = await asUser<{ r: RoomInfo }>(db, uid, 'select public.join_room($1, $2) as r', [code, name]);
  return row.r;
}

export async function addSong(db: Db, uid: string, roomId: string, videoId: string, title = 'Song'): Promise<string> {
  const [row] = await asUser<{ add_song: string }>(db, uid, 'select public.add_song($1, $2, $3)', [roomId, videoId, title]);
  return row.add_song;
}

export async function roomRow(db: Db, roomId: string) {
  const rows = await sudo<{
    status: string;
    host_id: string;
    is_playing: boolean;
    anchor_pos_ms: number;
    anchor_time: Date;
    current_song_id: string | null;
    state_version: number;
  }>(db, 'select * from public.rooms where id = $1', [roomId]);
  return rows[0];
}

/** Make a member look offline: last heartbeat `seconds` ago. */
export async function setSeenAgo(db: Db, roomId: string, uid: string, seconds: number) {
  await sudo(db, `update public.member_seen set seen_at = now() - make_interval(secs => $3)
                  where room_id = $1 and user_id = $2`, [roomId, uid, seconds]);
}

/** Pretend playback started `seconds` ago (anchor moved back). */
export async function setAnchorAgo(db: Db, roomId: string, seconds: number) {
  await sudo(db, `update public.rooms set anchor_time = now() - make_interval(secs => $2) where id = $1`, [roomId, seconds]);
}

export const SONG_IDS = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', 'M7lc1UVf-VE', 'aqz-KE-bpKQ', '9bZkp7q19f0'];
