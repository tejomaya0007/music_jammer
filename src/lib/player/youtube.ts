import type { Player, PlayerEvent } from './types';

/**
 * Real YouTube IFrame Player. Used when VITE_PLAYER=youtube (the default).
 * Loads https://www.youtube.com/iframe_api once. Not exercised by automated
 * tests (no network there); verify on a real device (see DEPLOY.md).
 */

interface YTPlayer {
  loadVideoById(o: { videoId: string; startSeconds: number }): void;
  cueVideoById(o: { videoId: string; startSeconds: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  stopVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, o: {
    width?: string | number;
    height?: string | number;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT as YTNamespace);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('Could not load the YouTube player'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** Creates the player inside `mount`. Must not be display:none (browsers pause hidden iframes). */
export async function createYouTubePlayer(mount: HTMLElement): Promise<Player> {
  const YT = await loadApi();
  const listeners = new Set<(e: PlayerEvent) => void>();
  const emit = (e: PlayerEvent) => listeners.forEach((cb) => cb(e));
  const host = document.createElement('div');
  mount.appendChild(host);

  let ready = false;
  let pendingLoad: (() => void) | null = null;
  let pendingCue: (() => void) | null = null;
  const yt: YTPlayer = await new Promise((resolve) => {
    const p: YTPlayer = new YT.Player(host, {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, origin: window.location.origin },
      events: {
        onReady: () => {
          ready = true;
          pendingLoad?.();
          pendingCue?.();
          pendingLoad = pendingCue = null;
          resolve(p);
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) emit({ type: 'ended' });
          else if (e.data === YT.PlayerState.PLAYING) emit({ type: 'playing' });
          else if (e.data === YT.PlayerState.PAUSED) emit({ type: 'paused' });
          else if (e.data === YT.PlayerState.BUFFERING) emit({ type: 'buffering' });
        },
        onError: () => emit({ type: 'error' }),
      },
    });
  });

  return {
    load(videoId, startSec, autoplay) {
      const run = () => (autoplay
        ? yt.loadVideoById({ videoId, startSeconds: startSec })
        : yt.cueVideoById({ videoId, startSeconds: startSec }));
      if (ready) run();
      else pendingLoad = run;
    },
    play: () => ready && yt.playVideo(),
    pause: () => ready && yt.pauseVideo(),
    seekTo: (sec) => ready && yt.seekTo(sec, true),
    stop: () => ready && yt.stopVideo(),
    getCurrentTime: () => (ready ? yt.getCurrentTime() : 0),
    getDuration: () => (ready ? yt.getDuration() : 0),
    isPlaying: () => ready && yt.getPlayerState() === YT.PlayerState.PLAYING,
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    destroy() {
      listeners.clear();
      try {
        yt.destroy();
      } finally {
        host.remove();
      }
    },
  };
}
