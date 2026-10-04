/** Row shapes as the database returns them (snake_case). api.ts maps them to app types. */

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: 'active' | 'idle' | 'closed';
  current_song_id: string | null;
  is_playing: boolean;
  anchor_pos_ms: number;
  anchor_time: string;
  state_version: number;
  max_members: number;
  last_activity_at: string;
  created_at: string;
}

export interface SongRow {
  id: string;
  room_id: string;
  video_id: string;
  title: string;
  thumbnail: string | null;
  added_by: string | null;
  position: number;
  created_at: string;
}

export interface MemberRow {
  user_id: string;
  name: string;
  joined_at: string;
  is_kicked: boolean;
}

export interface MessageRow {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string | null;
  kind: 'user' | 'system';
  text: string;
  created_at: string;
}

export interface RoomSnapshot {
  /** null when the caller cannot see the room (not a member, kicked, or it does not exist) */
  room: RoomRow | null;
  songs: SongRow[];
  members: MemberRow[];
  messages: MessageRow[];
}

export interface RealtimeHandlers {
  /** something changed in the room: refetch the snapshot */
  onChange(): void;
  /** the set of user ids online right now (Presence) */
  onPresence(onlineUserIds: string[]): void;
}

/**
 * The only thing the app knows about the backend.
 * Implemented by supabase.ts (production) and mock.ts (tests and local dev).
 */
export interface Backend {
  /** Anonymous sign-in. Returns a stable user id, reusing the stored session. */
  signIn(): Promise<string>;
  /** Call a SQL function. Throws Error(message) with the Postgres message on failure. */
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
  /** Read the room through RLS. */
  snapshot(roomId: string): Promise<RoomSnapshot>;
  /** Realtime changes + Presence for one room. Returns an unsubscribe function. */
  subscribe(roomId: string, userId: string, handlers: RealtimeHandlers): () => void;
}
