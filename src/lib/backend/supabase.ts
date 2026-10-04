import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend, RoomRow, SongRow, MemberRow, MessageRow, RoomSnapshot, RealtimeHandlers } from './types';

/**
 * Production backend: supabase-js talking straight to the project.
 * Nothing here runs unless VITE_BACKEND=supabase. Needs VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY (see .env.example). The anon key is public by design:
 * RLS and the SQL functions are the security.
 */

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }
  client = createClient(url, key, { auth: { persistSession: true, storageKey: 'jam-room-auth' } });
  return client;
}

export const supabaseBackend: Backend = {
  async signIn() {
    const { data: sess } = await sb().auth.getSession();
    if (sess.session) return sess.session.user.id;
    const { data, error } = await sb().auth.signInAnonymously();
    if (error || !data.user) throw new Error(error?.message ?? 'Anonymous sign-in failed');
    return data.user.id;
  },

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb().rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  },

  async snapshot(roomId: string): Promise<RoomSnapshot> {
    const s = sb();
    const [room, songs, members, messages] = await Promise.all([
      s.from('rooms').select('*').eq('id', roomId).maybeSingle(),
      s.from('songs').select('*').eq('room_id', roomId).order('position', { ascending: true }),
      s.from('room_members').select('user_id,name,avatar,joined_at,is_kicked').eq('room_id', roomId).order('joined_at', { ascending: true }),
      s.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100),
    ]);
    for (const r of [room, songs, members, messages]) if (r.error) throw new Error(r.error.message);
    return {
      room: (room.data as RoomRow | null) ?? null,
      songs: (songs.data ?? []) as SongRow[],
      members: (members.data ?? []) as MemberRow[],
      messages: ((messages.data ?? []) as MessageRow[]).reverse(),
    };
  },

  subscribe(roomId: string, userId: string, h: RealtimeHandlers) {
    const s = sb();
    const onChange = () => h.onChange();
    const channel = s
      .channel(`room:${roomId}`, { config: { presence: { key: userId } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs', filter: `room_id=eq.${roomId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, onChange)
      .on('presence', { event: 'sync' }, () => {
        h.onPresence(Object.keys(channel.presenceState()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId });
          // (re)connected: reload the full snapshot to repair anything missed
          h.onChange();
        }
      });
    return () => {
      void s.removeChannel(channel);
    };
  },
};
