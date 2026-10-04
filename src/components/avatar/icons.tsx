import type { ReactElement } from 'react';
import type { AvatarIcon } from '../../lib/avatars';

/** The 12 flat, vintage-sticker avatar icons (DESIGN.md 6.1). Drawn in a 48 px box, no image files. */
const INK = '#2b1b12';
const PAPER = '#f2e8d5';

const ICON_ART: Record<AvatarIcon, ReactElement> = {
  vinyl: (
    <g>
      <circle cx="24" cy="24" r="17" fill={INK} />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#4a3426" strokeWidth="1" />
      <circle cx="24" cy="24" r="9" fill="none" stroke="#4a3426" strokeWidth="1" />
      <circle cx="24" cy="24" r="5.5" fill="#d6453d" />
      <circle cx="24" cy="24" r="1.2" fill={PAPER} />
    </g>
  ),
  cassette: (
    <g>
      <rect x="7" y="13" width="34" height="22" rx="3" fill={INK} />
      <rect x="11" y="18" width="26" height="8" rx="1.5" fill={PAPER} />
      <circle cx="18" cy="31" r="3" fill="none" stroke={PAPER} strokeWidth="1.5" />
      <circle cx="30" cy="31" r="3" fill="none" stroke={PAPER} strokeWidth="1.5" />
    </g>
  ),
  headphones: (
    <g>
      <path d="M11 28 V23 a13 13 0 0 1 26 0 V28" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="7" y="25" width="8" height="13" rx="3" fill={INK} />
      <rect x="33" y="25" width="8" height="13" rx="3" fill={INK} />
    </g>
  ),
  boombox: (
    <g>
      <rect x="5" y="16" width="38" height="20" rx="4" fill={INK} />
      <path d="M14 16 V12 h20 v4" fill="none" stroke={INK} strokeWidth="2.5" />
      <circle cx="15" cy="26" r="6" fill="#4a3426" stroke={PAPER} strokeWidth="1" />
      <circle cx="33" cy="26" r="6" fill="#4a3426" stroke={PAPER} strokeWidth="1" />
    </g>
  ),
  microphone: (
    <g>
      <rect x="18" y="6" width="12" height="22" rx="6" fill={INK} />
      <path d="M11 22 a13 13 0 0 0 26 0" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M24 35 V42 M17 42 h14" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  guitar: (
    <g>
      <circle cx="18" cy="30" r="9" fill={INK} />
      <circle cx="28" cy="22" r="8" fill={INK} />
      <rect x="25" y="4" width="4" height="22" fill={INK} transform="rotate(35 27 15)" />
      <circle cx="18" cy="30" r="2" fill={PAPER} />
    </g>
  ),
  'piano-keys': (
    <g>
      <rect x="5" y="12" width="38" height="26" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={5 + i * 5.4} y="26" width="0.8" height="12" fill={INK} />
      ))}
      {[0, 1, 3, 4, 5].map((i) => (
        <rect key={i} x={8.4 + i * 5.4} y="12" width="3.6" height="14" rx="0.8" fill={INK} />
      ))}
    </g>
  ),
  radio: (
    <g>
      <rect x="6" y="16" width="36" height="24" rx="4" fill={INK} />
      <path d="M10 16 L38 6" stroke={INK} strokeWidth="2" />
      <circle cx="30" cy="28" r="6" fill="#4a3426" stroke={PAPER} strokeWidth="1" />
      <rect x="11" y="23" width="12" height="3" rx="1" fill={PAPER} />
    </g>
  ),
  jukebox: (
    <g>
      <path d="M8 40 V20 a16 14 0 0 1 32 0 V40 Z" fill={INK} />
      <circle cx="24" cy="22" r="5" fill="#d6453d" />
      <circle cx="16" cy="30" r="2.4" fill={PAPER} />
      <circle cx="24" cy="30" r="2.4" fill={PAPER} />
      <circle cx="32" cy="30" r="2.4" fill={PAPER} />
    </g>
  ),
  speaker: (
    <g>
      <rect x="11" y="6" width="26" height="36" rx="4" fill={INK} />
      <circle cx="24" cy="18" r="5" fill="#4a3426" stroke={PAPER} strokeWidth="1" />
      <circle cx="24" cy="32" r="8" fill="#4a3426" stroke={PAPER} strokeWidth="1" />
    </g>
  ),
  'tape-reel': (
    <g>
      <circle cx="24" cy="24" r="17" fill={INK} />
      <circle cx="24" cy="24" r="10" fill="#4a3426" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x="23" y="14" width="2" height="7" fill={PAPER} transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="3" fill={PAPER} />
    </g>
  ),
  ipod: (
    <g>
      <rect x="13" y="4" width="22" height="40" rx="4" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <rect x="16" y="8" width="16" height="12" rx="1" fill={INK} />
      <circle cx="24" cy="31" r="7" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="24" cy="31" r="2.2" fill={INK} />
    </g>
  ),
};

export function AvatarArt({ icon }: { icon: AvatarIcon }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">
      {ICON_ART[icon]}
    </svg>
  );
}
