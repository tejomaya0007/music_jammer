/** Warm palette for avatars; the colour is picked from the user id so it stays stable. */
const TONES = ['#f2c14e', '#e98b5b', '#9ec5a1', '#c4a6e8', '#7fb8d8', '#e8788a', '#d7c9a6'];

export function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
