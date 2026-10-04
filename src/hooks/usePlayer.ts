import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPlayer, type Player } from '../lib/player';
import { driftCorrectionTarget, expectedPositionMs } from '../lib/sync';
import { useRoomStore, selectCurrentSong } from '../state/roomStore';
import { currentPosMs, reportSongEnded, serverNowMs } from '../state/session';

const DRIFT_LOOP_MS = 2000;

/**
 * Connects the video player to the shared room state.
 * The rooms row is the source of truth; this hook only moves the local player to match it.
 * Nothing touches the player until the user taps "Tap to join the music" (autoplay rules).
 */
export function usePlayer(mountRef: RefObject<HTMLDivElement | null>): Player | null {
  const [player, setPlayer] = useState<Player | null>(null);
  const loadedSongId = useRef<string | null>(null);
  const buffering = useRef(false);
  const song = useRoomStore(selectCurrentSong);
  const unlocked = useRoomStore((s) => s.unlocked);
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);
  const anchorPos = useRoomStore((s) => s.room?.anchor_pos_ms ?? 0);
  const anchorTime = useRoomStore((s) => s.room?.anchor_time ?? '');
  const version = useRoomStore((s) => s.room?.state_version ?? 0);

  // create the player once the room screen (and its mount point) is on screen
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let p: Player | null = null;
    let unsub: (() => void) | null = null;
    createPlayer(mount).then((created) => {
      if (cancelled) {
        created.destroy();
        return;
      }
      p = created;
      unsub = created.onEvent((e) => {
        const id = loadedSongId.current;
        if (e.type === 'buffering') buffering.current = true;
        if (e.type === 'playing' || e.type === 'paused') buffering.current = false;
        if (!id) return;
        if (e.type === 'ended') void reportSongEnded(id, false);
        if (e.type === 'error') void reportSongEnded(id, true);
      });
      setPlayer(created);
    });
    return () => {
      cancelled = true;
      unsub?.();
      p?.destroy();
      loadedSongId.current = null;
      setPlayer(null);
    };
  }, [mountRef]);

  // apply the shared state whenever it changes
  useEffect(() => {
    if (!player || !unlocked) return;
    const s = useRoomStore.getState().room;
    if (!song || !s) {
      if (loadedSongId.current) player.stop();
      loadedSongId.current = null;
      return;
    }
    const expectedSec = currentPosMs() / 1000;
    if (loadedSongId.current !== song.id) {
      loadedSongId.current = song.id;
      player.load(song.video_id, expectedSec, isPlaying);
      // the seek bar needs the length straight away, or it clamps to 0:01 until the next tick
      useRoomStore.setState({ durationSec: player.getDuration() });
      return;
    }
    if (isPlaying && !player.isPlaying()) player.play();
    if (!isPlaying && player.isPlaying()) player.pause();
    // an explicit change (seek, pause, skip) corrects at once, no cool-down
    const driftMs = Math.abs(player.getCurrentTime() * 1000 - expectedSec * 1000);
    if (driftMs > 300) player.seekTo(expectedSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the shared state fields
  }, [player, unlocked, song?.id, song?.video_id, isPlaying, anchorPos, anchorTime, version]);

  // slow drift loop: keep friends within about a second while playing
  useEffect(() => {
    if (!player) return;
    let lastCorrection = 0;
    // one drift check; the rooms row is the truth, the player follows it
    const check = (cooldown: boolean) => {
      const st = useRoomStore.getState();
      if (!st.unlocked || !st.room || !loadedSongId.current) return;
      const duration = player.getDuration();
      if (duration !== st.durationSec) useRoomStore.setState({ durationSec: duration });
      const target = driftCorrectionTarget({
        playerPosMs: player.getCurrentTime() * 1000,
        expectedMs: expectedPositionMs(
          { anchorPosMs: st.room.anchor_pos_ms, anchorTimeMs: new Date(st.room.anchor_time).getTime(), isPlaying: st.room.is_playing },
          serverNowMs(),
        ),
        isPlaying: st.room.is_playing,
        buffering: buffering.current,
        nowMs: Date.now(),
        lastCorrectionMs: cooldown ? lastCorrection : 0,
      });
      if (target !== null) {
        player.seekTo(target / 1000);
        lastCorrection = Date.now();
        useRoomStore.setState({ lastCorrectionMs: lastCorrection });
      }
    };
    const timer = setInterval(() => check(true), DRIFT_LOOP_MS);
    // a fresh load reports 'playing' only after buffering: correct right then, not two seconds later
    const unsub = player.onEvent((e) => {
      if (e.type === 'playing') check(false);
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [player]);

  return player;
}
