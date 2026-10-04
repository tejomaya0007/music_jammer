import { useEffect } from 'react';
import { useRoomStore, selectCurrentSong } from '../state/roomStore';
import { next, playPause, prev } from '../state/session';

/**
 * Lock-screen and notification controls (Media Session API).
 * Title and artwork follow the current song; the buttons call the same RPCs as the screen.
 * Browsers without the API (or without it enabled) simply skip this.
 */
export function useMediaSession() {
  const song = useRoomStore(selectCurrentSong);
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);

  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    ms.metadata = song
      ? new MediaMetadata({
          title: song.title,
          artist: 'Jam Room',
          artwork: song.thumbnail ? [{ src: song.thumbnail, sizes: '480x360', type: 'image/jpeg' }] : [],
        })
      : null;
  }, [song]);

  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    ms.playbackState = song ? (isPlaying ? 'playing' : 'paused') : 'none';
  }, [song, isPlaying]);

  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    // play and pause only act when the room is not already in that state
    const playing = () => useRoomStore.getState().room?.is_playing ?? false;
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ['play', () => { if (!playing()) void playPause(); }],
      ['pause', () => { if (playing()) void playPause(); }],
      ['nexttrack', () => void next()],
      ['previoustrack', () => void prev()],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* this browser does not support the action */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
}
