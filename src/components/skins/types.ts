import type { SongRow } from '../../lib/api';

/** Every skin takes the same props and calls the same actions (DESIGN.md 7.0). */
export interface SkinProps {
  song: SongRow | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVolume: (v: number) => void;
}

/** Playback progress 0 to 1, or 0 when the length is unknown. */
export function progressOf(positionMs: number, durationMs: number): number {
  return durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
}
