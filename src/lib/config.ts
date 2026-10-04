/** Build-time switches. See .env.example (production) and .env.mock (local, tests). */
export const BACKEND: 'supabase' | 'mock' = import.meta.env.VITE_BACKEND === 'mock' ? 'mock' : 'supabase';
export const PLAYER: 'youtube' | 'fake' = import.meta.env.VITE_PLAYER === 'fake' ? 'fake' : 'youtube';

/** Room size, mirrored from schema.sql (rooms.max_members default). */
export const MAX_MEMBERS = 10;
export const QUEUE_CAP = 200;
export const CHAT_MAX = 500;
