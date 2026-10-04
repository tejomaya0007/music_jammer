import { describe, it, expect, beforeAll } from 'vitest';
import type { Db } from './helpers';
import {
  freshDb, newUser, asUser, tryAs, sudo, createRoom, joinRoom, addSong,
  roomRow, setSeenAgo, setAnchorAgo, SONG_IDS,
} from './helpers';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);

const q = (sql: string, params: unknown[] = []) => sudo<any>(db, sql, params);
const songs = (roomId: string) => q('select * from songs where room_id = $1 order by position', [roomId]);
const messages = (roomId: string) => q("select kind, text from messages where room_id = $1 order by created_at, id", [roomId]);
const members = (roomId: string) => q('select user_id, is_kicked from room_members where room_id = $1', [roomId]);

describe('create_room', () => {
  it('creates a room with a 6-char code, host and member, and posts a system line', async () => {
    const a = await newUser(db);
    const room = await createRoom(db, a, 'Ana');
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    const row = await roomRow(db, room.id);
    expect(row.host_id).toBe(a);
    expect(row.status).toBe('active');
    expect(await members(room.id)).toEqual([{ user_id: a, is_kicked: false }]);
    expect((await messages(room.id)).map((m) => m.text)).toEqual(['Ana created the room']);
  });

  it('rejects an empty name', async () => {
    const a = await newUser(db);
    const r = await tryAs(db, a, 'select public.create_room($1)', ['   ']);
    expect(r).toEqual({ ok: false, error: 'Please enter a name' });
  });

  it('rejects a call with no signed-in user', async () => {
    const r = await tryAs(db, null, 'select public.create_room($1)', ['X']);
    expect(r).toEqual({ ok: false, error: 'Not signed in' });
  });

  it('truncates long names to 30 chars', async () => {
    const a = await newUser(db);
    const room = await createRoom(db, a, 'x'.repeat(50));
    const [m] = await q('select name from room_members where room_id = $1', [room.id]);
    expect(m.name).toHaveLength(30);
  });
});

describe('join_room', () => {
  it('rejects a bad code with the friendly message', async () => {
    const a = await newUser(db);
    const r = await tryAs(db, a, 'select public.join_room($1, $2)', ['ZZZZZZ', 'Bo']);
    expect(r).toEqual({ ok: false, error: 'Room not found or closed' });
  });

  it('accepts codes case-insensitively and with spaces', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    const joined = await joinRoom(db, guest, ` ${room.code.toLowerCase()} `, 'Guest');
    expect(joined.id).toBe(room.id);
  });

  it('rejects a closed room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.close_room($1)', [room.id]);
    const guest = await newUser(db);
    const r = await tryAs(db, guest, 'select public.join_room($1, $2)', [room.code, 'Guest']);
    expect(r).toEqual({ ok: false, error: 'Room not found or closed' });
  });

  it('rejects when the room is full (max 10 members)', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    for (let i = 1; i < 10; i++) await joinRoom(db, await newUser(db), room.code, `P${i}`);
    const r = await tryAs(db, await newUser(db), 'select public.join_room($1, $2)', [room.code, 'Late']);
    expect(r).toEqual({ ok: false, error: 'Room is full' });
  });

  it('blocks a kicked member from rejoining the same room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'Guest');
    await asUser(db, host, 'select public.kick_member($1, $2)', [room.id, guest]);
    const r = await tryAs(db, guest, 'select public.join_room($1, $2)', [room.code, 'Guest']);
    expect(r).toEqual({ ok: false, error: 'You were removed from this room' });
  });

  it('rejoining reuses the membership row and updates the name; no duplicate join line', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'Guest');
    await joinRoom(db, guest, room.code, 'Guest2');
    expect(await members(room.id)).toHaveLength(2);
    const [m] = await q('select name from room_members where room_id = $1 and user_id = $2', [room.id, guest]);
    expect(m.name).toBe('Guest2');
    const joins = (await messages(room.id)).filter((x) => x.text === 'Guest joined');
    expect(joins).toHaveLength(1);
  });

  it('posts a "joined" system line for a new member', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await joinRoom(db, await newUser(db), room.code, 'Bo');
    expect((await messages(room.id)).map((m) => m.text)).toContain('Bo joined');
  });

  it('when the room is idle (host gone), the first person back becomes host', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.leave_room($1)', [room.id]);
    expect((await roomRow(db, room.id)).status).toBe('idle');
    const back = await newUser(db);
    await joinRoom(db, back, room.code, 'Back');
    const row = await roomRow(db, room.id);
    expect(row.host_id).toBe(back);
    expect(row.status).toBe('active');
  });
});

describe('leave_room', () => {
  it('removes the member, posts "left", and the room keeps playing for others', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'Guest');
    await addSong(db, host, room.id, SONG_IDS[0]);
    expect((await roomRow(db, room.id)).is_playing).toBe(true);
    await asUser(db, guest, 'select public.leave_room($1)', [room.id]);
    expect((await members(room.id)).map((m) => m.user_id)).toEqual([host]);
    expect((await messages(room.id)).map((m) => m.text)).toContain('Guest left');
    const row = await roomRow(db, room.id);
    expect(row.is_playing).toBe(true);
    expect(row.status).toBe('active');
  });

  it('is a no-op for someone who is not in the room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, await newUser(db), 'select public.leave_room($1)', [room.id]);
    expect(r.ok).toBe(true);
    expect(await members(room.id)).toHaveLength(1);
  });

  it('last person leaving idles the room and pauses it, keeping queue and chat', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[1]);
    await setAnchorAgo(db, room.id, 4);
    await asUser(db, host, 'select public.leave_room($1)', [room.id]);
    const row = await roomRow(db, room.id);
    expect(row.status).toBe('idle');
    expect(row.is_playing).toBe(false);
    expect(row.anchor_pos_ms).toBeGreaterThanOrEqual(3500);
    expect(await songs(room.id)).toHaveLength(1);
    expect((await messages(room.id)).length).toBeGreaterThan(1);
  });
});

describe('host transfer', () => {
  it('when the host leaves, the longest-joined member who is online becomes host', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const c = await newUser(db);
    await joinRoom(db, c, room.code, 'C');
    await asUser(db, host, 'select public.leave_room($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(b);
    expect((await messages(room.id)).map((m) => m.text)).toContain('B is now the host');
  });

  it('prefers an online member over an older offline one', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const c = await newUser(db);
    await joinRoom(db, c, room.code, 'C');
    await setSeenAgo(db, room.id, b, 120);
    await asUser(db, host, 'select public.leave_room($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(c);
  });

  it('heartbeat takes over host after the host has been silent for 40 s', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const c = await newUser(db);
    await joinRoom(db, c, room.code, 'C');
    await setSeenAgo(db, room.id, host, 41);
    // only the longest-present online member's heartbeat applies the takeover
    await asUser(db, c, 'select public.heartbeat($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(host);
    await asUser(db, b, 'select public.heartbeat($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(b);
  });

  it('heartbeat does not take over while the host is still within 40 s', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    await setSeenAgo(db, room.id, host, 30);
    await asUser(db, b, 'select public.heartbeat($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(host);
  });

  it('heartbeat only hands host to the longest-present online member, not to every caller', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const c = await newUser(db);
    await joinRoom(db, c, room.code, 'C');
    await setSeenAgo(db, room.id, host, 41);
    await asUser(db, c, 'select public.heartbeat($1)', [room.id]);
    await asUser(db, b, 'select public.heartbeat($1)', [room.id]);
    expect((await roomRow(db, room.id)).host_id).toBe(b);
  });

  it('heartbeat by a non-member is rejected', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, await newUser(db), 'select public.heartbeat($1)', [room.id]);
    expect(r).toEqual({ ok: false, error: 'Not a member of this room' });
  });
});

describe('transfer_host', () => {
  it('host hands the crown to a chosen member and the old host becomes a normal member', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    await asUser(db, host, 'select public.transfer_host($1, $2)', [room.id, b]);
    expect((await roomRow(db, room.id)).host_id).toBe(b);
    expect((await messages(room.id)).map((m) => m.text)).toContain('B is now the host');
    // old host lost admin powers
    const r = await tryAs(db, host, 'select public.kick_member($1, $2)', [room.id, b]);
    expect(r).toEqual({ ok: false, error: 'Only the host can do that' });
    // new host has them
    await asUser(db, b, 'select public.close_room($1)', [room.id]);
    expect((await roomRow(db, room.id)).status).toBe('closed');
  });

  it('only the host can transfer', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const r = await tryAs(db, b, 'select public.transfer_host($1, $2)', [room.id, b]);
    expect(r).toEqual({ ok: false, error: 'Only the host can do that' });
  });

  it('cannot transfer to someone who is not in the room or was kicked', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    await asUser(db, host, 'select public.kick_member($1, $2)', [room.id, b]);
    const kicked = await tryAs(db, host, 'select public.transfer_host($1, $2)', [room.id, b]);
    expect(kicked).toEqual({ ok: false, error: 'That person is not in this room' });
    const stranger = await newUser(db);
    const none = await tryAs(db, host, 'select public.transfer_host($1, $2)', [room.id, stranger]);
    expect(none).toEqual({ ok: false, error: 'That person is not in this room' });
  });
});

describe('kick and close are host-only', () => {
  it('a non-host cannot kick', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const c = await newUser(db);
    await joinRoom(db, c, room.code, 'C');
    const r = await tryAs(db, b, 'select public.kick_member($1, $2)', [room.id, c]);
    expect(r).toEqual({ ok: false, error: 'Only the host can do that' });
    expect((await members(room.id)).find((m) => m.user_id === c)?.is_kicked).toBe(false);
  });

  it('a non-host cannot close the room', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'B');
    const r = await tryAs(db, b, 'select public.close_room($1)', [room.id]);
    expect(r).toEqual({ ok: false, error: 'Only the host can do that' });
    expect((await roomRow(db, room.id)).status).toBe('active');
  });

  it('host cannot kick themselves', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, host, 'select public.kick_member($1, $2)', [room.id, host]);
    expect(r).toEqual({ ok: false, error: 'You cannot remove yourself' });
  });

  it('host kick removes access and posts a system line', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const b = await newUser(db);
    await joinRoom(db, b, room.code, 'Bo');
    await asUser(db, host, 'select public.kick_member($1, $2)', [room.id, b]);
    expect((await messages(room.id)).map((m) => m.text)).toContain('Bo was removed by the host');
    expect((await asUser(db, b, 'select id from rooms where id = $1', [room.id]))).toHaveLength(0);
  });

  it('host close ends the room for everyone and join is then refused', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.close_room($1)', [room.id]);
    expect((await roomRow(db, room.id)).status).toBe('closed');
    const r = await tryAs(db, await newUser(db), 'select public.join_room($1, $2)', [room.code, 'Late']);
    expect(r).toEqual({ ok: false, error: 'Room not found or closed' });
  });
});

describe('rejoin after everyone was offline', () => {
  it('freezes playback where it stopped, paused', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[2]);
    await setAnchorAgo(db, room.id, 10);
    await setSeenAgo(db, room.id, host, 120);
    const back = await newUser(db);
    await joinRoom(db, back, room.code, 'Back');
    const row = await roomRow(db, room.id);
    expect(row.is_playing).toBe(false);
    expect(row.anchor_pos_ms).toBeGreaterThanOrEqual(9500);
    expect(row.anchor_pos_ms).toBeLessThan(12000);
  });
});

describe('add_song', () => {
  it('rejects an invalid video id', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    for (const bad of ['short', 'waytoolongvideoid', 'bad$chars!!']) {
      const r = await tryAs(db, host, 'select public.add_song($1, $2, $3)', [room.id, bad, 'T']);
      expect(r).toEqual({ ok: false, error: 'Invalid video id' });
    }
  });

  it('autostarts the first song and leaves the current song alone for later ones', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const first = await addSong(db, host, room.id, SONG_IDS[0], 'First');
    let row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(first);
    expect(row.is_playing).toBe(true);
    const second = await addSong(db, host, room.id, SONG_IDS[1], 'Second');
    row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(first);
    expect(second).not.toBe(first);
  });

  it('stores title fallback and the server-built thumbnail', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.add_song($1, $2, $3)', [room.id, SONG_IDS[3], '   ']);
    const [s] = await songs(room.id);
    expect(s.title).toBe('YouTube video');
    expect(s.thumbnail).toBe(`https://i.ytimg.com/vi/${SONG_IDS[3]}/mqdefault.jpg`);
    expect(s.added_by).toBe(host);
  });

  it('caps the queue at 200 songs', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await sudo(db, `insert into songs (room_id, video_id, title, position)
                    select $1, 'aaaaaaaaaaa', 'x', g from generate_series(1, 200) g`, [room.id]);
    const r = await tryAs(db, host, 'select public.add_song($1, $2, $3)', [room.id, SONG_IDS[0], 'T']);
    expect(r).toEqual({ ok: false, error: 'Queue is full (200 songs)' });
  });

  it('a non-member cannot add', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, await newUser(db), 'select public.add_song($1, $2, $3)', [room.id, SONG_IDS[0], 'T']);
    expect(r).toEqual({ ok: false, error: 'Not a member of this room' });
  });
});

describe('remove_song', () => {
  it('removing the current song moves to the next one and keeps playing state', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.remove_song($1)', [a]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(b);
    expect(row.is_playing).toBe(true);
  });

  it('removing the last current song clears selection and stops', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, host, 'select public.remove_song($1)', [a]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBeNull();
    expect(row.is_playing).toBe(false);
  });

  it('removing a non-current song leaves playback alone', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.remove_song($1)', [b]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(a);
    expect(await songs(room.id)).toHaveLength(1);
  });

  it('any member can remove a song, a stranger cannot', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'G');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const stranger = await newUser(db);
    const bad = await tryAs(db, stranger, 'select public.remove_song($1)', [a]);
    expect(bad.ok).toBe(false);
    expect(await songs(room.id)).toHaveLength(1);
    await asUser(db, guest, 'select public.remove_song($1)', [a]);
    expect(await songs(room.id)).toHaveLength(0);
  });
});

describe('reorder_song', () => {
  it('sets the new position and reorders the list', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0], 'A');
    await addSong(db, host, room.id, SONG_IDS[1], 'B');
    const c = await addSong(db, host, room.id, SONG_IDS[2], 'C');
    await asUser(db, host, 'select public.reorder_song($1, $2)', [c, 0.5]);
    expect((await songs(room.id)).map((s) => s.title)).toEqual(['C', 'A', 'B']);
    await asUser(db, host, 'select public.reorder_song($1, $2)', [a, 10]);
    expect((await songs(room.id)).map((s) => s.title)).toEqual(['C', 'B', 'A']);
  });

  it('rejects NaN, Infinity and null positions (they would corrupt the queue order)', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0], 'A');
    await addSong(db, host, room.id, SONG_IDS[1], 'B');
    for (const bad of ['NaN', 'Infinity', '-Infinity', null]) {
      const r = await tryAs(db, host, 'select public.reorder_song($1, $2::double precision)', [a, bad]);
      expect(r.ok, String(bad)).toBe(false);
    }
    expect((await songs(room.id)).map((s) => s.title)).toEqual(['A', 'B']);
  });

  it('dragging the playing song does not interrupt it', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0], 'A');
    await addSong(db, host, room.id, SONG_IDS[1], 'B');
    await asUser(db, host, 'select public.reorder_song($1, $2)', [a, 99]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(a);
    expect(row.is_playing).toBe(true);
  });
});

describe('playback play / pause / seek', () => {
  it('play with nothing selected starts the first song in queue order', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0], 'A');
    const b = await addSong(db, host, room.id, SONG_IDS[1], 'B');
    await asUser(db, host, 'select public.playback($1, $2)', [room.id, 'pause']);
    await sudo(db, 'update rooms set current_song_id = null, is_playing = false where id = $1', [room.id]);
    await asUser(db, host, 'select public.playback($1, $2)', [room.id, 'play']);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(a);
    expect(row.current_song_id).not.toBe(b);
    expect(row.is_playing).toBe(true);
  });

  it('play on an empty queue fails', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, host, 'select public.playback($1, $2)', [room.id, 'play']);
    expect(r).toEqual({ ok: false, error: 'The queue is empty' });
  });

  it('pause captures the position; play resumes from it', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    await setAnchorAgo(db, room.id, 10);
    await asUser(db, host, 'select public.playback($1, $2)', [room.id, 'pause']);
    let row = await roomRow(db, room.id);
    expect(row.is_playing).toBe(false);
    expect(row.anchor_pos_ms).toBeGreaterThanOrEqual(9500);
    await sudo(db, 'update rooms set anchor_time = now() - interval \'30 seconds\' where id = $1', [room.id]);
    await asUser(db, host, 'select public.playback($1, $2)', [room.id, 'play']);
    row = await roomRow(db, room.id);
    expect(row.is_playing).toBe(true);
    expect(row.anchor_pos_ms).toBeGreaterThanOrEqual(9500);
    expect(row.anchor_pos_ms).toBeLessThan(11000);
  });

  it('seek sets the anchor position for everyone and clamps negatives to 0', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'G');
    await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, guest, 'select public.playback($1, $2, $3)', [room.id, 'seek', 65000]);
    let row = await roomRow(db, room.id);
    expect(row.anchor_pos_ms).toBe(65000);
    expect(row.is_playing).toBe(true);
    await asUser(db, host, 'select public.playback($1, $2, $3)', [room.id, 'seek', -500]);
    row = await roomRow(db, room.id);
    expect(row.anchor_pos_ms).toBe(0);
  });

  it('unknown action is refused', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, host, 'select public.playback($1, $2)', [room.id, 'rewind']);
    expect(r).toEqual({ ok: false, error: 'Unknown action' });
  });

  it('a non-member cannot control playback', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    const r = await tryAs(db, await newUser(db), 'select public.playback($1, $2)', [room.id, 'pause']);
    expect(r).toEqual({ ok: false, error: 'Not a member of this room' });
  });
});

describe('play_song', () => {
  it('jumps to a chosen queue item and starts it', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.play_song($1, $2)', [room.id, b]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(b);
  });
});

describe('next_song / prev_song', () => {
  it('next moves by queue order and bumps state_version', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    const v = (await roomRow(db, room.id)).state_version;
    await asUser(db, host, 'select public.next_song($1, $2)', [room.id, v]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(b);
    expect(row.state_version).toBe(v + 1);
    expect(a).not.toBe(b);
  });

  it('next past the end stops playback with nothing selected', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, host, 'select public.next_song($1, null)', [room.id]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBeNull();
    expect(row.is_playing).toBe(false);
  });

  it('a stale version is ignored, so a double-click does not skip twice', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    const c = await addSong(db, host, room.id, SONG_IDS[2]);
    const v = (await roomRow(db, room.id)).state_version;
    await asUser(db, host, 'select public.next_song($1, $2)', [room.id, v]);
    await asUser(db, host, 'select public.next_song($1, $2)', [room.id, v]); // second click, same version
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(b);
    expect(row.current_song_id).not.toBe(c);
  });

  it('prev restarts the current song when more than 5 s in', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.play_song($1, $2)', [room.id, b]);
    await setAnchorAgo(db, room.id, 6);
    await asUser(db, host, 'select public.prev_song($1, null)', [room.id]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(b);
    expect(row.anchor_pos_ms).toBe(0);
    expect(row.is_playing).toBe(true);
  });

  it('prev within the first 5 s goes to the previous song', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.play_song($1, $2)', [room.id, b]);
    await setAnchorAgo(db, room.id, 2);
    await asUser(db, host, 'select public.prev_song($1, null)', [room.id]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(a);
  });

  it('prev on the first song restarts it (nothing before)', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    await setAnchorAgo(db, room.id, 2);
    await asUser(db, host, 'select public.prev_song($1, null)', [room.id]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(a);
  });

  it('prev with a stale version is ignored', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    const before = await roomRow(db, room.id);
    await asUser(db, host, 'select public.prev_song($1, $2)', [room.id, before.state_version - 1]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(before.current_song_id);
    expect(b).toBeTruthy();
  });
});

describe('song_ended', () => {
  it('auto-advances when the current song ends', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.song_ended($1, $2, false)', [room.id, a]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(b);
  });

  it('duplicate end reports from other clients are harmless', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'G');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    const c = await addSong(db, host, room.id, SONG_IDS[2]);
    await asUser(db, host, 'select public.song_ended($1, $2, false)', [room.id, a]);
    await asUser(db, guest, 'select public.song_ended($1, $2, false)', [room.id, a]);
    await asUser(db, host, 'select public.song_ended($1, $2, false)', [room.id, a]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBe(b);
    expect(row.current_song_id).not.toBe(c);
  });

  it('an error report posts a "skipped" line and skips', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0], 'Broken Song');
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.song_ended($1, $2, true)', [room.id, a]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(b);
    expect((await messages(room.id)).map((m) => m.text)).toContain('Couldn\'t play "Broken Song", skipped');
  });

  it('a null song id never starts playback (null is not "nothing selected")', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, host, 'select public.next_song($1, null)', [room.id]); // nothing selected now
    expect((await roomRow(db, room.id)).current_song_id).toBeNull();
    await asUser(db, host, 'select public.song_ended($1, null, false)', [room.id]);
    const row = await roomRow(db, room.id);
    expect(row.current_song_id).toBeNull();
    expect(row.is_playing).toBe(false);
  });

  it('a report for a song that is not current is ignored', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    const b = await addSong(db, host, room.id, SONG_IDS[1]);
    await asUser(db, host, 'select public.song_ended($1, $2, false)', [room.id, b]);
    expect((await roomRow(db, room.id)).current_song_id).toBe(a);
  });

  it('ending the last song leaves nothing selected', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const a = await addSong(db, host, room.id, SONG_IDS[0]);
    await asUser(db, host, 'select public.song_ended($1, $2, false)', [room.id, a]);
    expect((await roomRow(db, room.id)).current_song_id).toBeNull();
  });
});

describe('send_message', () => {
  it('stores trimmed text, ignores empty text', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.send_message($1, $2)', [room.id, '   hi there  ']);
    await asUser(db, host, 'select public.send_message($1, $2)', [room.id, '   ']);
    const user = (await messages(room.id)).filter((m) => m.text !== 'Host created the room');
    expect(user.map((m) => m.text)).toEqual(['hi there']);
  });

  it('truncates to 500 characters', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    await asUser(db, host, 'select public.send_message($1, $2)', [room.id, 'a'.repeat(600)]);
    const [m] = (await messages(room.id)).slice(-1);
    expect(m.text).toHaveLength(500);
  });

  it('rate limits to 8 messages per 10 s', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    for (let i = 0; i < 8; i++) {
      await asUser(db, host, 'select public.send_message($1, $2)', [room.id, `m${i}`]);
    }
    const r = await tryAs(db, host, 'select public.send_message($1, $2)', [room.id, 'one too many']);
    expect(r).toEqual({ ok: false, error: 'Slow down a little' });
  });

  it('non-members cannot post', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const r = await tryAs(db, await newUser(db), 'select public.send_message($1, $2)', [room.id, 'hi']);
    expect(r.ok).toBe(false);
  });
});

describe('get_server_time', () => {
  it('returns epoch milliseconds', async () => {
    const r = await asUser<{ t: string }>(db, await newUser(db), 'select public.get_server_time()::text as t');
    const ms = Number(r[0].t);
    expect(Math.abs(ms - Date.now())).toBeLessThan(60_000);
  });
});

describe('member presence rows never change room realtime', () => {
  it('heartbeat writes only member_seen, not rooms', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const before = await roomRow(db, room.id);
    await asUser(db, host, 'select public.heartbeat($1)', [room.id]);
    const after = await roomRow(db, room.id);
    expect(after.state_version).toBe(before.state_version);
    expect(after.is_playing).toBe(before.is_playing);
  });
});

describe('avatars', () => {
  const avatarOf = async (roomId: string, uid: string) =>
    (await q('select avatar from room_members where room_id = $1 and user_id = $2', [roomId, uid]))[0].avatar;

  it('create stores the avatar, join stores it for the new member', async () => {
    const host = await newUser(db);
    const room = (await asUser(db, host, 'select public.create_room($1, $2) as r', ['Ana', 'cassette:teal']))[0] as any;
    expect(await avatarOf(room.r.id, host)).toBe('cassette:teal');
    const guest = await newUser(db);
    await asUser(db, guest, 'select public.join_room($1, $2, $3)', [room.r.code, 'Bo', 'vinyl:amber']);
    expect(await avatarOf(room.r.id, guest)).toBe('vinyl:amber');
  });

  it('rejects junk avatar strings on create and join', async () => {
    const host = await newUser(db);
    for (const bad of ['', 'cassette', 'Cassette:Teal', 'x:y', 'cassette:teal;drop', 'a'.repeat(40) + ':amber', 'cassette:teal ']) {
      const r = await tryAs(db, host, 'select public.create_room($1, $2)', ['Ana', bad]);
      expect(r, bad).toEqual({ ok: false, error: 'Invalid avatar' });
    }
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    const r = await tryAs(db, guest, 'select public.join_room($1, $2, $3)', [room.code, 'Bo', 'bad avatar']);
    expect(r).toEqual({ ok: false, error: 'Invalid avatar' });
  });

  it('rejoining updates the avatar; rejoining without one keeps the stored avatar', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'Bo');
    expect(await avatarOf(room.id, guest)).toBeNull();
    await asUser(db, guest, 'select public.join_room($1, $2, $3)', [room.code, 'Bo', 'ipod:rose']);
    expect(await avatarOf(room.id, guest)).toBe('ipod:rose');
    await asUser(db, guest, 'select public.join_room($1, $2, $3)', [room.code, 'Bo', 'radio:sky']);
    expect(await avatarOf(room.id, guest)).toBe('radio:sky');
    await asUser(db, guest, 'select public.join_room($1, $2)', [room.code, 'Bo']);
    expect(await avatarOf(room.id, guest)).toBe('radio:sky');
  });
});

describe('a removed member cannot rejoin by leaving first', () => {
  it('kicked user calls leave_room, then join_room is still refused', async () => {
    const host = await newUser(db);
    const room = await createRoom(db, host, 'Host');
    const guest = await newUser(db);
    await joinRoom(db, guest, room.code, 'Guest');
    await asUser(db, host, 'select public.kick_member($1, $2)', [room.id, guest]);
    await asUser(db, guest, 'select public.leave_room($1)', [room.id]);
    const r = await tryAs(db, guest, 'select public.join_room($1, $2)', [room.code, 'Guest']);
    expect(r).toEqual({ ok: false, error: 'You were removed from this room' });
    expect((await members(room.id)).find((m) => m.user_id === guest)?.is_kicked).toBe(true);
  });
});
