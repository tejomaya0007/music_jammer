import { create } from 'zustand';
import type { MemberRow, MessageRow, RoomRow, SongRow } from '../lib/api';

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

  chatOpen: boolean;
  unread: number;
  toasts: Toast[];
  pending: number;

  patch: (p: Partial<RoomState>) => void;
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
