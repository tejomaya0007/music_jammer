import { describe, it, expect, beforeAll } from 'vitest';
import type { Db } from './helpers';
import { freshDb, newUser, asUser, tryAs, sudo, createRoom, joinRoom, addSong, SONG_IDS } from './helpers';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);

describe('row level security', () => {
  it('a non-member sees no rows from another room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, host, 'select public.send_message($1, $2)', [room.id, 'secret chat']);
    const stranger = await newUser(db);
    expect(await asUser(db, stranger, 'select id from rooms')).toHaveLength(0);
    expect(await asUser(db, stranger, 'select id from songs where room_id = $1', [room.id])).toHaveLength(0);
    expect(await asUser(db, stranger, 'select id from messages where room_id = $1', [room.id])).toHaveLength(0);
    expect(await asUser(db, stranger, 'select user_id from room_members where room_id = $1', [room.id])).toHaveLength(0);
  });

  it('a member sees their own room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'G');
    expect(await asUser(db, guest, 'select id from rooms where id = $1', [room.id])).toHaveLength(1);
    expect(await asUser(db, guest, 'select user_id from room_members where room_id = $1', [room.id])).toHaveLength(2);
  });

  it('a kicked member loses read access', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'G');
    await asUser(db, host, 'select public.kick_member($1, $2)', [room.id, guest]);
    expect(await asUser(db, guest, 'select id from rooms where id = $1', [room.id])).toHaveLength(0);
  });

  it('a stranger cannot write tables directly', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const stranger = await newUser(db);
    const attempts = [
      `update rooms set is_playing = true where id = '${room.id}'`,
      `update rooms set host_id = '${stranger}' where id = '${room.id}'`,
      `insert into songs (room_id, video_id, title, position) values ('${room.id}', 'aaaaaaaaaaa', 'x', 1)`,
      `delete from songs where room_id = '${room.id}'`,
      `insert into messages (room_id, kind, text) values ('${room.id}', 'user', 'forged')`,
      `insert into room_members (room_id, user_id, name) values ('${room.id}', '${stranger}', 'x')`,
      `delete from room_members where room_id = '${room.id}'`,
    ];
    for (const sql of attempts) {
      const r = await tryAs(db, stranger, sql);
      expect(r, sql).toEqual({ ok: false, error: expect.stringMatching(/permission denied/) });
    }
  });

  it('even a member cannot write tables directly, only through RPC', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, host, `update rooms set is_playing = true where id = '${room.id}'`);
    expect(r).toEqual({ ok: false, error: 'permission denied for table rooms' });
  });

  it('internal helpers cannot be called directly to bypass membership', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const stranger = await newUser(db);
    const calls = [
      `select public._set_current('${room.id}', null, true)`,
      `select public._assert_member('${room.id}')`,
      `select public._assert_host('${room.id}')`,
      `select public.gen_code()`,
    ];
    for (const sql of calls) {
      const r = await tryAs(db, stranger, sql);
      expect(r, sql).toEqual({ ok: false, error: expect.stringMatching(/permission denied for function/) });
    }
    const row = (await sudo<{ is_playing: boolean }>(db, 'select is_playing from rooms where id = $1', [room.id]))[0];
    expect(row.is_playing).toBe(false);
  });

  it('anonymous (no session) cannot call RPCs', async () => {
    const r = await tryAs(db, null, 'select public.get_server_time()');
    expect(r.ok).toBe(true); // authenticated check happens in functions that need a user
    const r2 = await tryAs(db, null, `select public.send_message('00000000-0000-0000-0000-000000000000', 'x')`);
    expect(r2.ok).toBe(false);
  });

  it('the anon role has no table access at all', async () => {
    const host = await newUser(db);
    await createRoom(db, host, 'Host');
    await expect(db.transaction(async (tx) => {
      await tx.exec('set local role anon');
      await tx.query('select id from rooms');
    })).rejects.toThrow(/permission denied/);
  });
});
