/**
 * Avatars: a built-in set of 12 icons and 8 ring colours (DESIGN.md 6.1).
 * An avatar is stored as "<icon>:<colour>", e.g. "cassette:teal". The database checks the same format.
 */

export const AVATAR_ICONS = [
  'vinyl', 'cassette', 'headphones', 'boombox', 'microphone', 'guitar',
  'piano-keys', 'radio', 'jukebox', 'speaker', 'tape-reel', 'ipod',
] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

export const AVATAR_COLORS = {
  amber: '#ffb547',
  red: '#d6453d',
  teal: '#2f8f7c',
  sky: '#5aa6d6',
  plum: '#9b6bb0',
  rose: '#e07a9a',
  lime: '#a6c94a',
  chrome: '#bdb9b0',
} as const;
export type AvatarColor = keyof typeof AVATAR_COLORS;
export const AVATAR_COLOR_IDS = Object.keys(AVATAR_COLORS) as AvatarColor[];

export interface Avatar {
  icon: AvatarIcon;
  color: AvatarColor;
}

const FORMAT = /^[a-z-]{2,20}:[a-z]{2,10}$/;

export function formatAvatar(a: Avatar): string {
  return `${a.icon}:${a.color}`;
}

/** Parses a stored avatar. Unknown or malformed values return null (the caller shows an initial instead). */
export function parseAvatar(value: string | null | undefined): Avatar | null {
  if (!value || !FORMAT.test(value)) return null;
  const [icon, color] = value.split(':');
  if (!(AVATAR_ICONS as readonly string[]).includes(icon)) return null;
  if (!AVATAR_COLOR_IDS.includes(color as AvatarColor)) return null;
  return { icon: icon as AvatarIcon, color: color as AvatarColor };
}

export function randomAvatar(rand: () => number = Math.random): Avatar {
  return {
    icon: AVATAR_ICONS[Math.floor(rand() * AVATAR_ICONS.length)],
    color: AVATAR_COLOR_IDS[Math.floor(rand() * AVATAR_COLOR_IDS.length)],
  };
}
