/**
 * Session controller: everything that talks to the backend for the current
 * user's room. UI components call these actions; they never call api directly
 * for session state.
 */
import { api, fetchTitle, type RoomSnapshot } from '../lib/api';
import { estimateClockOffset, reorderPosition, type ClockSample } from '../lib/sync';
import { parseVideoLinks } from '../lib/link';
import { QUEUE_CAP, CHAT_MAX } from '../lib/config';
import { readStore, writeStore } from '../lib/storage';
import { useRoomStore, toast, type RoomState, type Toast } from './roomStore';

const NAME_KEY = 'jam:name';
const ACTIVE_KEY = 'jam:active-room';
const HEARTBEAT_MS = 15_000;
const CLOCK_EVERY_MS = 5 * 60_000;

type Unsub = () => void;
let unsubscribeRealtime: Unsub | null = null;
let timers: ReturnType<typeof setInterval>[] = [];
let lastMessageId: string | null = null;
let refreshing = false;
let refreshAgain = false;
let visibilityHandler: (() => void) | null = null;

const get = () => useRoomStore.getState();
const patch = (p: Partial<RoomState>) => useRoomStore.setState(p);

/** Server-clock "now", using the offset from the last clock sync. */
export const serverNowMs = () => Date.now() + get().clockOffset;

async function run<T>(fn: () => Promise<T>, errorPrefix = ''): Promise<T | undefined> {
  patch({ pending: get().pending + 1 });
  try {
    return await fn();
  } catch (e) {
    toast(`${errorPrefix}${(e as Error).message}`, 'error');
    return undefined;
  } finally {
    patch({ pending: get().pending - 1 });
  }
}

export function getStoredName(): string {
  return readStore(NAME_KEY) ?? '';
}

export function setStoredName(name: string) {
  writeStore(NAME_KEY, name);
  patch({ name });
}

/**
 * Sign in anonymously once, then:
 *  - invite link + stored name: join that room
 *  - invite link, no name yet: the home form opens with the code filled in
 *  - no invite: rejoin the last room (survives a reload)
 */
let bootRun: Promise<void> | null = null;

/** Runs once per page load (StrictMode mounts twice; the second call must not reset the invite). */
export function boot(inviteCode: string | null = null): Promise<void> {
  bootRun ??= startBoot(inviteCode);
  return bootRun;
}

async function startBoot(inviteCode: string | null) {
  if (get().booted) return;
  patch({ invite: inviteCode });
  const userId = await api.signIn().catch((e: Error) => {
    toast(`Could not start: ${e.message}`, 'error');
    return null;
  });
  patch({ booted: true, userId, name: getStoredName() });
  if (!userId) return;
  if (inviteCode) {
    if (getStoredName()) await joinByCode(inviteCode, getStoredName());
    return;
  }
  const active = readStore(ACTIVE_KEY);
  if (active) {
    try {
      const { code, name } = JSON.parse(active) as { code: string; name: string };
      await joinByCode(code, name || getStoredName());
    } catch {
      writeStore(ACTIVE_KEY, null);
    }
  }
}

/** Step 1 of creating: make the room and show its code. Entering it is a separate step. */
export async function createRoom(name: string) {
  const clean = name.trim();
  if (!clean) return toast('Add your name to start', 'error');
  setStoredName(clean);
  const r = await run(() => api.createRoom(clean));
  if (r) patch({ pendingRoom: r });
}

/** Step 2: open the room that was just created. */
export async function openPendingRoom() {
  const p = get().pendingRoom;
  if (!p) return;
  patch({ pendingRoom: null });
  await enter(p.id, p.code);
}

/** Back out of a freshly created room: leave it so it goes idle, then return to home. */
export async function discardPendingRoom() {
  const p = get().pendingRoom;
  patch({ pendingRoom: null });
  if (p) await run(() => api.leaveRoom(p.id));
}

export async function joinByCode(code: string, name: string) {
  const clean = code.trim().toUpperCase();
  const who = name.trim();
  if (!who) return toast('Enter a display name first', 'error');
  if (!clean) return toast('Enter a room code', 'error');
  setStoredName(who);
  const r = await run(() => api.joinRoom(clean, who));
  if (r) await enter(r.id, r.code);
  else writeStore(ACTIVE_KEY, null);
}

async function enter(roomId: string, code: string) {
  leaveLocal();
  // the invite belongs to the first visit only: leaving later must not reopen the join form
  patch({ roomId, code, unlocked: false, chatOpen: false, unread: 0, invite: null });
  writeStore(ACTIVE_KEY, JSON.stringify({ code, name: get().name }));
  await refresh();
  void syncClock();
  startRealtime(roomId);
}

/** Load the full room state. Ends the session if the room is gone, closed, or the user was removed. */
export async function refresh() {
  const { roomId } = get();
  if (!roomId) return;
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  refreshing = true;
  try {
    const snap = await api.snapshot(roomId);
    if (get().roomId !== roomId) return;
    applySnapshot(snap);
  } catch {
    /* network blip: the next realtime event or heartbeat will try again */
  } finally {
    refreshing = false;
    if (refreshAgain) {
      refreshAgain = false;
      void refresh();
    }
  }
}

function applySnapshot(snap: RoomSnapshot) {
  const before = get();
  if (!snap.room) {
    endSession('This room was closed, or you were removed from it.');
    return;
  }
  if (snap.room.status === 'closed') {
    endSession('This room was closed by the host.');
    return;
  }
  // only announce a handover, not the creator's own first load
  if (before.room && before.userId && before.room.host_id !== before.userId && snap.room.host_id === before.userId) {
    toast("You're now the host");
  }
  // unread badge: other people's chat lines that arrived while the drawer is closed
  // (system lines like "X joined" and my own messages do not count)
  const idx = snap.messages.findIndex((m) => m.id === lastMessageId);
  const arrived = lastMessageId === null ? [] : snap.messages.slice(idx === -1 ? 0 : idx + 1);
  const newFromOthers = arrived.filter((m) => m.kind === 'user' && m.user_id !== before.userId).length;
  lastMessageId = snap.messages.at(-1)?.id ?? lastMessageId;
  patch({
    room: snap.room,
    songs: snap.songs,
    members: snap.members,
    messages: snap.messages,
    unread: before.chatOpen ? 0 : before.unread + newFromOthers,
  });
}

function startRealtime(roomId: string) {
  const userId = get().userId;
  if (!userId) return;
  unsubscribeRealtime = api.subscribe(roomId, userId, {
    onChange: () => void refresh(),
    onPresence: (online) => patch({ online }),
  });
  timers.push(setInterval(() => void beat(), HEARTBEAT_MS));
  timers.push(setInterval(() => void syncClock(), CLOCK_EVERY_MS));
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void beat();
      void refresh();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

async function beat() {
  const { roomId } = get();
  if (!roomId) return;
  try {
    await api.heartbeat(roomId);
  } catch (e) {
    if ((e as Error).message === 'Not a member of this room') endSession('You were removed from this room.');
  }
}

export async function syncClock() {
  const samples: ClockSample[] = [];
  for (let i = 0; i < 5; i++) {
    const sentMs = Date.now();
    try {
      const serverMs = await api.getServerTime();
      samples.push({ sentMs, receivedMs: Date.now(), serverMs: Number(serverMs) });
    } catch {
      break;
    }
  }
  if (samples.length) patch({ clockOffset: estimateClockOffset(samples) });
}

function leaveLocal() {
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
  timers.forEach((t) => clearInterval(t));
  timers = [];
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = null;
  lastMessageId = null;
}

function endSession(message?: string, tone: Toast['tone'] = 'error') {
  leaveLocal();
  writeStore(ACTIVE_KEY, null);
  patch({
    roomId: null, code: null, room: null, songs: [], members: [], messages: [],
    online: [], unlocked: false, unread: 0, chatOpen: false,
  });
  if (message) toast(message, tone);
}

export async function leaveRoom() {
  const { roomId } = get();
  if (!roomId) return;
  await run(() => api.leaveRoom(roomId), 'Could not leave: ');
  endSession('You left the room.', 'info');
}

// ----- host actions -----

export async function kick(userId: string, name: string) {
  const { roomId } = get();
  if (!roomId) return;
  const ok = await run(() => api.kickMember(roomId, userId));
  if (ok !== undefined) {
    toast(`${name} was removed`);
    void refresh();
  }
}

export async function transferHost(userId: string, name: string) {
  const { roomId } = get();
  if (!roomId) return;
  const ok = await run(() => api.transferHost(roomId, userId));
  if (ok !== undefined) {
    toast(`${name} is now the host`);
    void refresh();
  }
}

export async function closeRoom() {
  const { roomId } = get();
  if (!roomId) return;
  const ok = await run(() => api.closeRoom(roomId));
  if (ok !== undefined) endSession('You closed the room.');
}

// ----- queue -----

export async function addLinks(text: string): Promise<boolean> {
  const { roomId, songs } = get();
  if (!roomId) return false;
  const { ids, invalid } = parseVideoLinks(text);
  if (invalid.length) {
    toast(`Not a YouTube link: ${invalid[0]}`, 'error');
  }
  if (!ids.length) return false;
  if (songs.length + ids.length > QUEUE_CAP) {
    toast(`The queue holds ${QUEUE_CAP} songs. Remove some first.`, 'error');
    return false;
  }
  let added = 0;
  for (const id of ids) {
    const info = await fetchTitle(id);
    if (!info.playable) {
      toast(`Can't play that video here (private or embedding is off)`, 'error');
      continue;
    }
    const sid = await run(() => api.addSong(roomId, id, info.title));
    if (sid) added++;
  }
  void refresh();
  return added > 0;
}

export async function removeSong(songId: string) {
  const ok = await run(() => api.removeSong(songId));
  if (ok !== undefined) void refresh();
}

/** Drop `songId` between its new neighbours. Positions are midpoints, so only one row changes. */
export async function moveSong(songId: string, toIndex: number) {
  const { songs } = get();
  const others = songs.filter((s) => s.id !== songId);
  const prev = toIndex > 0 ? others[toIndex - 1] : undefined;
  const next = others[toIndex];
  const position = reorderPosition(prev?.position ?? null, next?.position ?? null);
  // optimistic: show the new order at once
  const moved = songs.find((s) => s.id === songId);
  if (moved) {
    const list = [...others];
    list.splice(toIndex, 0, { ...moved, position });
    patch({ songs: list });
  }
  await run(() => api.reorderSong(songId, position));
  void refresh(); // on failure this also restores the true order
}

// ----- playback -----

export async function playPause() {
  const { roomId, room } = get();
  if (!roomId || !room) return;
  await run(() => api.playback(roomId, room.is_playing ? 'pause' : 'play', currentPosMs()));
}

export async function seekTo(sec: number) {
  const { roomId } = get();
  if (!roomId) return;
  await run(() => api.playback(roomId, 'seek', sec * 1000));
}

export async function playSong(songId: string) {
  const { roomId } = get();
  if (!roomId) return;
  await run(() => api.playSong(roomId, songId));
}

export async function next() {
  const { roomId, room } = get();
  if (!roomId || !room) return;
  await run(() => api.nextSong(roomId, room.state_version));
}

export async function prev() {
  const { roomId, room } = get();
  if (!roomId || !room) return;
  await run(() => api.prevSong(roomId, room.state_version));
}

/** The position the room would be at right now, in ms. */
export function currentPosMs(): number {
  const { room } = get();
  if (!room) return 0;
  const anchorTime = new Date(room.anchor_time).getTime();
  const elapsed = room.is_playing ? Math.max(0, serverNowMs() - anchorTime) : 0;
  const pos = room.anchor_pos_ms + elapsed;
  return Number.isFinite(pos) ? Math.max(0, pos) : 0;
}

// ----- chat -----

export async function sendChat(text: string): Promise<boolean> {
  const { roomId } = get();
  const clean = text.trim();
  if (!roomId || !clean) return false;
  if (clean.length > CHAT_MAX) {
    toast(`Keep messages under ${CHAT_MAX} characters`, 'error');
    return false;
  }
  const ok = await run(() => api.sendMessage(roomId, clean));
  if (ok === undefined) return false;
  void refresh();
  return true;
}

export function setChatOpen(open: boolean) {
  patch({ chatOpen: open, unread: open ? 0 : get().unread });
}

export function unlockMusic() {
  patch({ unlocked: true });
}

/** Called by the player when a song ended or failed. The server ignores duplicates. */
export async function reportSongEnded(songId: string, failed: boolean) {
  const { roomId } = get();
  if (!roomId) return;
  try {
    await api.songEnded(roomId, songId, failed);
  } catch {
    /* ignore: the other clients report the same end */
  }
}

/** Test/debug hook: reset in-memory session state. */
export function resetSessionForTests() {
  leaveLocal();
  useRoomStore.setState({ roomId: null, room: null, songs: [], members: [], messages: [], booted: false, userId: null });
}
