import { create } from 'zustand';
import type { MemberRow, MessageRow, RoomRef, RoomRow, SongRow } from '../lib/api';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface RoomState {
  booted: boolean;
  userId: string | null;
  name: string;

  roomId: string | null;
  code: string | null;
  room: RoomRow | null;
  songs: SongRow[];
  members: MemberRow[];
  messages: MessageRow[];
  online: string[];

  /** browsers block autoplay until the first tap: no player work before this */
  unlocked: boolean;
  /** server minus client clock, ms */
  clockOffset: number;
  /** when the sync loop last seeked the player (ms, client clock) */
  lastCorrectionMs: number;
  /** length of the loaded video in seconds (0 when unknown); shown on the seek bar */
  durationSec: number;

  /** invite code from a shared link; cleared once the room is entered */
  invite: string | null;
  /** a room just created: show its code before entering */
  pendingRoom: RoomRef | null;
  /** this person's volume, 0 to 100 (local only) */
  volume: number;
  chatOpen: boolean;
  unread: number;
  toasts: Toast[];
  pending: number;

  patch: (p: Partial<RoomState>) => void;
}

const VOLUME_KEY = 'jam_volume';
function readVolume(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(VOLUME_KEY));
    return Number.isFinite(v) && globalThis.localStorage?.getItem(VOLUME_KEY) !== null ? Math.max(0, Math.min(100, v)) : 80;
  } catch {
    return 80;
  }
}

export const useRoomStore = create<RoomState>()((set) => ({
  booted: false,
  userId: null,
  name: '',
  roomId: null,
  code: null,
  room: null,
  songs: [],
  members: [],
  messages: [],
  online: [],
  unlocked: false,
  clockOffset: 0,
  lastCorrectionMs: 0,
  durationSec: 0,
  invite: null,
  pendingRoom: null,
  volume: readVolume(),
  chatOpen: false,
  unread: 0,
  toasts: [],
  pending: 0,
  patch: (p) => set(p),
}));

let toastSeq = 0;
/** Show a short message at the bottom of the screen; errors stay a bit longer. */
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastSeq;
  useRoomStore.setState((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) }));
  setTimeout(() => {
    useRoomStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, tone === 'error' ? 5000 : 2800);
}

export const selectCurrentSong = (s: RoomState): SongRow | null =>
  s.songs.find((x) => x.id === s.room?.current_song_id) ?? null;

/** Active members who are online. Returns a number, so it is safe inside a selector. */
export const selectOnlineCount = (s: RoomState): number =>
  s.members.filter((m) => !m.is_kicked && s.online.includes(m.user_id)).length;

export const selectHostName = (s: RoomState): string | null => {
  const host = s.members.find((m) => m.user_id === s.room?.host_id);
  return host?.name ?? null;
};

/** Volume is this person's only; it never touches the room. */
export function setVolume(percent: number) {
  const v = Math.max(0, Math.min(100, Math.round(percent)));
  useRoomStore.setState({ volume: v });
  try {
    globalThis.localStorage?.setItem(VOLUME_KEY, String(v));
  } catch {
    /* storage blocked */
  }
}
