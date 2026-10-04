import type { Player, PlayerEvent } from './types';

/**
 * Deterministic player for tests and the mock backend. No network.
 * Time advances on the real clock while "playing", like a real player would.
 *
 * Special video ids (see FAKE_* in lib/api.ts):
 *   SHORTVIDEO1   8 s long, so auto-advance is quick to test
 *   BROKENPLAY1   fails when loaded (exercises the skip path)
 * Everything else plays for 180 s.
 */

export const FAKE_SHORT = 'SHORTVIDEO1';
export const FAKE_BROKEN_PLAY = 'BROKENPLAY1';
const DEFAULT_LEN = 180;
const SHORT_LEN = 8;

export function createFakePlayer(node?: HTMLElement): Player {
  // the state is mirrored onto the DOM so tests can see what the "player" is doing
  const expose = (k: string, v: string) => node?.setAttribute(`data-${k}`, v);
  let videoId: string | null = null;
  let posSec = 0; // position when last paused/seeked/loaded
  let startedAt = 0; // wall clock ms when playback last started (0 = paused)
  let duration = DEFAULT_LEN;
  let ended = false;
  let volume = 100;
  const listeners = new Set<(e: PlayerEvent) => void>();

  const emit = (e: PlayerEvent) => listeners.forEach((cb) => cb(e));

  const now = () => Date.now();
  const current = () => {
    const t = startedAt ? posSec + (now() - startedAt) / 1000 : posSec;
    return Math.min(t, duration);
  };

  const tick = () => {
    if (startedAt && current() >= duration && !ended) {
      ended = true;
      posSec = duration;
      startedAt = 0;
      emit({ type: 'ended' });
    }
  };
  const timer = setInterval(tick, 100);

  return {
    load(id, startSec, autoplay) {
      videoId = id;
      duration = id === FAKE_SHORT ? SHORT_LEN : DEFAULT_LEN;
      posSec = Math.max(0, startSec);
      ended = false;
      startedAt = 0;
      expose('video', id);
      expose('duration', String(duration));
      if (id === FAKE_BROKEN_PLAY) {
        setTimeout(() => emit({ type: 'error', code: 150 }), 30); // 150: embedding not allowed, so the room skips
        return;
      }
      if (autoplay) {
        startedAt = now();
        setTimeout(() => emit({ type: 'playing' }), 0);
      } else {
        setTimeout(() => emit({ type: 'paused' }), 0);
      }
    },
    play() {
      if (!videoId || startedAt || ended) return;
      startedAt = now();
      expose('state', 'playing');
      emit({ type: 'playing' });
    },
    pause() {
      if (!startedAt) return;
      posSec = current();
      startedAt = 0;
      expose('state', 'paused');
      emit({ type: 'paused' });
    },
    seekTo(sec) {
      posSec = Math.max(0, Math.min(sec, duration));
      ended = false;
      if (startedAt) startedAt = now();
    },
    stop() {
      videoId = null;
      posSec = 0;
      startedAt = 0;
      ended = false;
    },
    getCurrentTime: () => (videoId ? current() : 0),
    getDuration: () => (videoId ? duration : 0),
    setPlaybackRate: () => undefined,
    setVolume: (percent) => { volume = Math.max(0, Math.min(100, percent)); expose('volume', String(volume)); },
    isPlaying: () => startedAt !== 0,
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    destroy() {
      clearInterval(timer);
      listeners.clear();
    },
  };
}
