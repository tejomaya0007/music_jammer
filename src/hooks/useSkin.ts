import { useState } from 'react';

export const SKINS = ['turntable', 'cassette', 'ipod'] as const;
export type Skin = (typeof SKINS)[number];
const KEY = 'jam_skin';

function read(): Skin {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return (SKINS as readonly string[]).includes(v ?? '') ? (v as Skin) : 'turntable';
  } catch {
    return 'turntable';
  }
}

/** The skin is per person and stays on this device. Changing it never touches playback. */
export function useSkin(): [Skin, (s: Skin) => void] {
  const [skin, setSkinState] = useState<Skin>(read);
  const setSkin = (s: Skin) => {
    setSkinState(s);
    try {
      globalThis.localStorage?.setItem(KEY, s);
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  };
  return [skin, setSkin];
}
