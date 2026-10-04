import { readStore, writeStore } from './storage';
import { parseAvatar, randomAvatar, formatAvatar } from './avatars';

/** The person's name and face, kept on this device. Skips onboarding once it exists. */
export interface Profile {
  name: string;
  /** stored form "<icon>:<colour>" */
  avatar: string;
}

const KEY = 'jam:profile';
const LEGACY_NAME_KEY = 'jam:name';

export function readProfile(): Profile | null {
  const raw = readStore(KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<Profile>;
      if (typeof p.name === 'string' && p.name.trim()) {
        return { name: p.name, avatar: parseAvatar(p.avatar) ? (p.avatar as string) : formatAvatar(randomAvatar()) };
      }
    } catch {
      /* fall through to the legacy name */
    }
  }
  // a name saved by an earlier version: keep it, give a random face
  const legacy = readStore(LEGACY_NAME_KEY);
  return legacy ? { name: legacy, avatar: formatAvatar(randomAvatar()) } : null;
}

export function saveProfile(p: Profile): void {
  writeStore(KEY, JSON.stringify({ name: p.name.trim().slice(0, 30), avatar: p.avatar }));
  writeStore(LEGACY_NAME_KEY, p.name.trim().slice(0, 30));
}

