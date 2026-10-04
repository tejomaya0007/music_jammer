/**
 * The only module the UI uses to reach the backend. Every RPC name and
 * argument name lives here, so the Supabase and mock backends stay swappable.
 */
import { backend } from './backend';
import type { RoomSnapshot } from './backend/types';
import { PLAYER } from './config';

export type { RoomRow, SongRow, MemberRow, MessageRow, RoomSnapshot } from './backend/types';

export interface RoomRef {
  id: string;
  code: string;
}

export type PlaybackAction = 'play' | 'pause' | 'seek';

export const api = {
  signIn: () => backend.signIn(),
  snapshot: (roomId: string): Promise<RoomSnapshot> => backend.snapshot(roomId),
  subscribe: backend.subscribe.bind(backend),

  createRoom: (name: string, avatar: string | null) => backend.rpc<RoomRef>('create_room', { p_name: name, p_avatar: avatar }),
  joinRoom: (code: string, name: string, avatar: string | null) =>
    backend.rpc<RoomRef>('join_room', { p_code: code, p_name: name, p_avatar: avatar }),
  leaveRoom: (roomId: string) => backend.rpc<void>('leave_room', { p_room: roomId }),
  heartbeat: (roomId: string) => backend.rpc<void>('heartbeat', { p_room: roomId }),
  kickMember: (roomId: string, userId: string) => backend.rpc<void>('kick_member', { p_room: roomId, p_user: userId }),
  transferHost: (roomId: string, userId: string) => backend.rpc<void>('transfer_host', { p_room: roomId, p_user: userId }),
  closeRoom: (roomId: string) => backend.rpc<void>('close_room', { p_room: roomId }),

  addSong: (roomId: string, videoId: string, title: string) =>
    backend.rpc<string>('add_song', { p_room: roomId, p_video: videoId, p_title: title }),
  removeSong: (songId: string) => backend.rpc<void>('remove_song', { p_song: songId }),
  reorderSong: (songId: string, position: number) => backend.rpc<void>('reorder_song', { p_song: songId, p_pos: position }),

  playback: (roomId: string, action: PlaybackAction, posMs = 0) =>
    backend.rpc<void>('playback', { p_room: roomId, p_action: action, p_pos: Math.round(posMs) }),
  playSong: (roomId: string, songId: string) => backend.rpc<void>('play_song', { p_room: roomId, p_song: songId }),
  nextSong: (roomId: string, version: number | null) =>
    backend.rpc<void>('next_song', { p_room: roomId, p_version: version }),
  prevSong: (roomId: string, version: number | null) =>
    backend.rpc<void>('prev_song', { p_room: roomId, p_version: version }),
  songEnded: (roomId: string, songId: string, error: boolean) =>
    backend.rpc<void>('song_ended', { p_room: roomId, p_song: songId, p_error: error }),

  sendMessage: (roomId: string, text: string) => backend.rpc<void>('send_message', { p_room: roomId, p_text: text }),
  getServerTime: () => backend.rpc<number>('get_server_time', {}),
};

/** Video titles come from YouTube's oEmbed (no API key). Failure falls back to a generic title. */
export const FAKE_BROKEN_ON_ADD = 'BROKENADD11'; // fake player: oEmbed fails, add is rejected
export const FAKE_BROKEN_ON_PLAY = 'BROKENPLAY1'; // fake player: adds fine, errors when played

export async function fetchTitle(videoId: string): Promise<{ title: string; playable: boolean }> {
  if (PLAYER === 'fake') {
    return { title: `Fake song ${videoId}`, playable: videoId !== FAKE_BROKEN_ON_ADD };
  }
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
    if (!res.ok) return { title: `YouTube video ${videoId}`, playable: false };
    const data = (await res.json()) as { title?: string };
    return { title: data.title ?? `YouTube video ${videoId}`, playable: true };
  } catch {
    return { title: `YouTube video ${videoId}`, playable: true };
  }
}
