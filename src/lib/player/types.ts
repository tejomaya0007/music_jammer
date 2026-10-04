/** What the sync code needs from a video player. Implemented by youtube.ts and fake.ts. */

/** code: the YouTube error number (100/101/150 mean the video itself cannot play here) */
export type PlayerEvent = { type: 'ended' } | { type: 'error'; code?: number } | { type: 'buffering' } | { type: 'playing' } | { type: 'paused' };

export interface Player {
  /** Load a video at a start position. autoplay=false cues it (paused). */
  load(videoId: string, startSec: number, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seekTo(sec: number): void;
  /** Unload whatever is playing. */
  stop(): void;
  /** Current position in seconds. */
  getCurrentTime(): number;
  /** Length in seconds, 0 when unknown. */
  getDuration(): number;
  /** 0 to 100 */
  setVolume(percent: number): void;
  /** playback speed, 1 = normal (used for gentle sync nudges) */
  setPlaybackRate(rate: number): void;
  isPlaying(): boolean;
  onEvent(cb: (e: PlayerEvent) => void): () => void;
  destroy(): void;
}
